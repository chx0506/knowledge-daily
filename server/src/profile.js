// 用户画像引擎
//
// 关键设计依据（实测得出）：
// 平台侧 question recommend 在账号样本稀疏时会返回泛人生/情感向问题，
// 不能直接当作画像结果。因此链路必须是：
//   ① 无 query 探测（拿平台原始画像，仅作参考；PROFILE_PLATFORM_PROBE 缺省 off，零 creator）
//   ② 自有信号提取候选标签（关注 / 收藏 / 创作）
//   ③ 搜索话题核验（候选标签必须出现在搜索结果标题里——双向子串；成本走 zhihu_search）
import crypto from 'node:crypto';
import { config } from './config.js';
import { withCache } from './cache.js';
import {
  recommendQuestions, searchZhihu, fetchFollowees, fetchContents,
  fetchFavoriteLists, fetchRecentFavorites, ZhihuApiError,
} from './zhihu-client.js';
import {
  getPreferences, feedbackTopicScores, suppressedTopics,
  getFeedbacks, FEEDBACK_WEIGHTS,
} from './preferences.js';
import { tagMatchesDomain } from './domains.js';

/**
 * 兴趣置信度分层（方案 5.1）
 * high   : 长期关注、重复收藏、用户主动选择
 * medium : 近期多次阅读或正向反馈
 * low    : 一次点击或短期热点
 */
export const SIGNAL_TIER = {
  user_direction: 'high',
  favorite_list: 'high',
  favorite_item: 'high',
  own_content: 'medium',
  followee_semantic: 'medium',
  feedback_positive: 'medium',
  platform_recommend: 'low',
  cold_start_default: 'low',
};

/** 冷启动预设标签（纪要 17:20：先预设标签供用户选择体验） */
export const COLD_START_TAGS = [
  'AI 产品设计',
  '独立开发者 App 变现',
  '信息过载 阅读方式',
  '交互设计',
  '科技行业观察',
  '学习方法',
];

const STOPWORDS = new Set([
  '的','了','和','与','是','在','有','我','你','他','她','它','们',
  '知乎','用户','问题','回答','文章','分享','什么','怎么','如何','为什么',
  // 话语标记与修辞套话：n-gram 会从标题里误抽出这些非主题词（实测：收藏标题
  // 「平心而论红楼梦是不是被严重高估了」抽出了标签「平心而论」并通过了复查）
  '平心而论','如何看待','怎么看待','怎么看','是不是','有没有','能不能','要不要',
  '该不该','不是吗','真的吗','到底','究竟','大家觉得','你觉得',
]);

/** 知乎默认收藏夹名：不携带任何兴趣语义，只计入信号覆盖度，不作标签候选 */
const GENERIC_FAVLIST_NAMES = new Set([
  '我的收藏', '我的收藏夹', '默认收藏', '默认收藏夹', '收藏夹', '收藏',
]);

/**
 * 句法碎片成分表：含这些连接/疑问成分的 n-gram 是句子骨架的碎片，
 * 不是主题词（真实案例：「平心而论红楼梦是不是…」切出「心而论红」「而论红楼」）。
 * 命中即整个 n-gram 丢弃。
 */
const FRAGMENT_PARTS = [
  '而论', '是不是', '为什么', '怎么', '如何', '什么', '哪些',
  '吗', '呢', '谁', '的是', '有了', '这个', '那个',
  // 扩展句法成分（同为虚词，几乎不可能出现在真实主题词中）：
  '的', '是', '么', '不是', '那么',
];

/**
 * 单字动词/介词前缀：n-gram 以其开头且余下 ≥2 字时剥掉首字再计数
 * （「论红楼梦」→「红楼梦」、「读史记」→「史记」）。
 * 已知残余风险：会误伤以这些字开头的真词（如「论文热点」→「文热点」），
 * 靠吸收去重与频次排序把误伤产物压在尾部，见报告。
 */
const PREFIX_STRIP = new Set(['论', '谈', '评', '议', '说', '看', '聊', '侃', '析', '读']);

/** 从一段文本里抽取候选关键词（轻量，不引入分词依赖） */
export function extractKeywords(text, limit = 5) {
  if (!text) return [];
  const cleaned = String(text).replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
  const tokens = [];
  // 书名号内容：作者显式标记的作品名（书/影视/文章），是标题里最强的主题信号。
  // 实测：「为什么很多人读不下去《红楼梦》？」的 n-gram top-3 全被句法碎片
  // （很多人读/不下去/多人读不）占满；own6 里红楼梦 freq 与碎片打平后又被
  // 4 字碎片以长度优先反超——书名号词不再参与频次竞争，结果中直接置顶保送，
  // 同时照常计入 freq（与其 n-gram 碎片经吸收去重汇合，巩固频次）。
  const quoted = [];
  for (const m of String(text).matchAll(/《([^《》]{2,15})》/g)) {
    const w = m[1].trim();
    if (w.length >= 2 && !STOPWORDS.has(w) && !quoted.includes(w)) quoted.push(w);
  }
  tokens.push(...quoted);
  // 英文词
  for (const m of cleaned.matchAll(/[a-zA-Z][a-zA-Z0-9+#.]{1,}/g)) {
    if (m[0].length >= 2) tokens.push(m[0]);
  }
  // 中文 2-4 字滑窗 + 碎片过滤 + 前缀剥离
  for (const seg of cleaned.match(/[\u4e00-\u9fa5]{2,}/g) ?? []) {
    for (let n = 4; n >= 2; n -= 1) {
      for (let i = 0; i + n <= seg.length; i += 1) {
        let w = seg.slice(i, i + n);
        if (STOPWORDS.has(w)) continue;
        // ① 碎片过滤：含连接/疑问成分的 n-gram 直接丢弃
        if (FRAGMENT_PARTS.some((p) => w.includes(p))) continue;
        // ② 前缀剥离：单字动词/介词开头且余下 ≥2 字，剥掉首字
        while (w.length >= 3 && PREFIX_STRIP.has(w[0])) w = w.slice(1);
        tokens.push(w);
      }
    }
  }
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  // ③ 吸收去重：token A 是 token B 的真子串且 freq(A) ≤ freq(B) → A 的计数并入 B、
  // 丢弃 A；freq(A) > freq(B) 时认为子串在多个上下文独立高频出现（如「苹果」），
  // 保留两者，不把独立热词错误吞掉。
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const dropped = new Set();
  for (let i = 0; i < sorted.length; i += 1) {
    const [a, ca] = sorted[i];
    if (dropped.has(a)) continue;
    for (let j = 0; j < sorted.length; j += 1) {
      if (i === j) continue;
      const [b, cb] = sorted[j];
      if (dropped.has(b)) continue;
      if (b.length > a.length && b.includes(a) && ca <= cb) {
        sorted[j][1] = cb + ca;
        dropped.add(a);
        break;
      }
    }
  }
  const ranked = sorted
    .filter(([w]) => !dropped.has(w))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([w]) => w);
  // 书名号词置顶保送（去重后并入头部），其余按频次排序
  return [...new Set([...quoted, ...ranked])].slice(0, limit);
}

/** 近 N 天内的内容加权（纪要 31:44：以近一两个月数据为推荐基准） */
function recencyWeight(unixSeconds) {
  if (!unixSeconds) return 0.5;
  const days = (Date.now() / 1000 - Number(unixSeconds)) / 86400;
  if (days <= config.profileWindowDays) return 1;
  if (days <= config.profileWindowDays * 3) return 0.6;
  return 0.3;
}

/** 安全调用：单路信号失败不拖垮整个画像；但配额耗尽（30001/30002）继续上抛，
 * 由日报组装层走「上一期 + stale」降级（方案 10.4），而不是产出一份被掏空的画像。 */
async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZhihuApiError && err.isQuota) throw err;
    const detail = err instanceof ZhihuApiError
      ? `${err.name}(code=${err.code ?? '-'}): ${err.message}`
      : String(err.message || err);
    return { __error: `${label}: ${detail}`, value: fallback };
  }
}
const unwrap = (r, fallback) => (r && r.__error ? fallback : r);
const errOf = (r) => (r && r.__error ? r.__error : null);

/**
 * 生成用户画像。
 * @param {string|null} oauthToken 有则读授权用户，无则读 Access Secret 本人
 * @param {string} userRef 用于缓存与返回标识（不含 token）
 * @param {string[]} manualTags 一次性覆盖标签（调试或 URL 传入）
 */
export async function buildProfile({ oauthToken = null, userRef = 'self', manualTags = [] } = {}) {
  const prefs = getPreferences(userRef);
  const fbScores = feedbackTopicScores(userRef);
  const blocked = suppressedTopics(userRef);
  // 偏好与反馈变化时必须让缓存失效。
  // 注意：只放 fbScores.size 时，在已有主题上追加正向反馈 size 不变、缓存不失效；
  // 因此把反馈记录数与权重总和一并放进戳里，任何反馈变化都会失效画像缓存。
  const fbList = getFeedbacks(userRef);
  const fbWeightSum = fbList.reduce((s, f) => s + (FEEDBACK_WEIGHTS[f.feedback] ?? 0), 0);
  const stamp = `${prefs.updatedAt}:${fbScores.size}:${blocked.size}:${fbList.length}:${fbWeightSum}`;
  const cacheKey = `profile:${userRef}:${manualTags.join(',')}:${stamp}`;

  const { value, cached } = await withCache(cacheKey, config.cacheTtl.profile, async () => {
    const warnings = [];

    // ---- ① 平台侧画像探测（无 query）----
    // 任务五：PROFILE_PLATFORM_PROBE 缺省 off（默认路径 creator=0）；
    // 开 = 每用户每画像周期（24h 缓存）消耗 1 点 creator，见 README 成本模型。
    const rPlatform = config.profilePlatformProbe
      ? await safe('platform_recommend',
        () => recommendQuestions({ count: 10, oauthToken }), [])
      : [];
    const platformItems = unwrap(rPlatform, []);
    if (errOf(rPlatform)) warnings.push(errOf(rPlatform));

    // ---- ② 自有三路信号 ----
    const [rFollow, rFav, rRecent, rOwn] = await Promise.all([
      safe('followees', () => fetchFollowees({ limit: 50, oauthToken }), { items: [] }),
      safe('favorite_lists', () => fetchFavoriteLists({ limit: 50, oauthToken }), []),
      safe('recent_favorites', () => fetchRecentFavorites({ limit: 50, oauthToken }), []),
      safe('own_contents', () => fetchContents({ limit: 50, oauthToken }), { items: [] }),
    ]);
    for (const r of [rFollow, rFav, rRecent, rOwn]) {
      const e = errOf(r); if (e) warnings.push(e);
    }

    const followees = unwrap(rFollow, { items: [] }).items ?? [];
    const favLists = unwrap(rFav, []) ?? [];
    const recentFavs = unwrap(rRecent, []) ?? [];
    const ownContents = unwrap(rOwn, { items: [] }).items ?? [];

    // 候选标签打分表：name -> { score, sources:Set, evidence:[], items:Set }
    const cand = new Map();
    const bump = (name, score, source, evidence) => {
      if (!name || name.length < 2) return;
      const key = name.trim();
      if (!cand.has(key)) cand.set(key, { score: 0, sources: new Set(), evidence: [], items: new Set() });
      const c = cand.get(key);
      c.score += score;
      c.sources.add(source);
      if (evidence) {
        // 记录「不同条目」的身份（条目 URL，回退到 label），供语料支撑度判据使用。
        // 注意 evidence 本身封顶 3 条，不能拿它当计数用。
        const id = String(evidence.url || evidence.label || '');
        if (id) c.items.add(id);
        if (c.evidence.length < 3) c.evidence.push(evidence);
      }
    };

    // 关注的人：签名语义
    for (const f of followees) {
      for (const kw of extractKeywords(f.Headline, 2)) {
        bump(kw, 0.8, 'followee_semantic', {
          type: 'followee', label: f.Fullname || kw, url: f.Url || '',
        });
      }
    }
    // 收藏夹名：最强信号，标题往往就是现成标签
    // 但默认收藏夹名（「我的收藏」等）无语义，跳过候选、仍计入 signal_coverage
    for (const fl of favLists) {
      if (GENERIC_FAVLIST_NAMES.has(String(fl.Title ?? '').trim())) continue;
      bump(fl.Title, 2.0, 'favorite_list', {
        type: 'favorite_list', label: fl.Title, url: fl.Url || '',
      });
      for (const kw of extractKeywords(fl.Description, 2)) {
        bump(kw, 0.6, 'favorite_list', { type: 'favorite_list', label: fl.Title, url: fl.Url || '' });
      }
    }
    // 收藏内容：带时间衰减
    for (const it of recentFavs) {
      const w = recencyWeight(it.FavTime);
      for (const kw of extractKeywords(it.Title, 3)) {
        bump(kw, 1.2 * w, 'favorite_item', {
          type: 'favorite_item', label: it.Title?.slice(0, 40) ?? kw, url: it.Url || '',
        });
      }
    }
    // 本人创作：点赞数加权
    for (const it of ownContents) {
      const w = recencyWeight(it.CreatedAt) * (1 + Math.log10(1 + (it.LikeCount ?? 0)) / 3);
      for (const kw of extractKeywords(it.Title, 3)) {
        bump(kw, 0.9 * w, 'own_content', {
          type: 'own_content', label: it.Title?.slice(0, 40) ?? kw, url: it.Url || '',
        });
      }
    }

    // 手动标签与用户主动选择的学习方向：最高优先级（方案 5.1 高置信度）
    for (const t of manualTags) bump(t, 6.0, 'user_direction', null);
    for (const d of prefs.directions) {
      bump(d, 5.0, 'user_direction', { type: 'user_direction', label: d, url: '' });
    }
    for (const k of prefs.keywords) {
      bump(k, 3.0, 'user_direction', { type: 'user_keyword', label: k, url: '' });
    }
    // 日报内反馈：正向加权，负向降权
    for (const [topic, score] of fbScores) {
      if (score > 0) {
        bump(topic, score, 'feedback_positive', { type: 'feedback', label: `正向反馈 ${topic}`, url: '' });
      } else if (cand.has(topic)) {
        cand.get(topic).score += score; // 负分直接扣，可能被挤出候选
      }
    }

    // ---- 语料支撑度：真实兴趣会在多个条目里反复出现，切句碎片只来自单条 ----
    // 实测（真实账号）：收藏「平心而论红楼梦是不是被严重高估了？」会切出「严重高估」，
    // 它只由这 1 条支撑，却能通过下面的搜索核验蒙混过关——因为该短语在站内确实存在
    // （搜到的还是足球新闻）。「是真实话题」不等于「是用户的兴趣」。
    // 故要求：来自内容条目的标签至少被 2 个不同条目支撑；
    // 用户主动给出 / 收藏夹名 / 正向反馈属高信任来源，不受此限。
    const TRUSTED_SOURCES = new Set(['user_direction', 'favorite_list', 'feedback_positive']);
    const wellSupported = ([, meta]) => meta.items.size >= 2
      || [...meta.sources].some((s) => TRUSTED_SOURCES.has(s));
    // 画像本身稀疏（条目太少）时不启用该判据，避免把仅有的标签也筛没
    const sparseCorpus = recentFavs.length + ownContents.length + followees.length < 4;

    let candidates = [...cand.entries()]
      .filter(([name, meta]) => meta.score > 0 && !blocked.has(name))
      .sort((a, b) => b[1].score - a[1].score);
    if (!sparseCorpus) {
      const supported = candidates.filter(wellSupported);
      if (supported.length > 0) candidates = supported;
    }
    candidates = candidates.slice(0, 6);

    // ---- ③ 冷启动兜底 ----
    let coldStart = false;
    if (candidates.length === 0) {
      coldStart = true;
      // 预设标签按顺序递减，避免全部并列最高权重
      candidates = COLD_START_TAGS
        .filter((t) => !blocked.has(t))
        .slice(0, 3)
        .map((name, i) => [
          name, { score: 1 - i * 0.2, sources: new Set(['cold_start_default']), evidence: [] },
        ]);
    }

    // ---- ④ 搜索话题核验（任务五：成本从 creator 挪到 zhihu_search 5000/天）----
    // 候选标签必须能作为真实话题存在：任一搜索结果标题包含该标签（双向子串，
    // 最小长度 2，复用 domains.js 的 tagMatchesDomain）。切词碎片（如「被严重高」）
    // 不会出现在任何标题里 → 淘汰；真实话题（如「红楼梦」）保留。
    // qverify:${tag} 缓存 6h、跨用户共享：同一标签的核验搜索一天最多打几次。
    // 例外：用户主动输入的方向/关键词（user_direction）拥有最高信任级别，
    // 不参与搜索标题否决——否则生僻措辞或仿真路由偏差会把用户明确选择的方向误淘汰。
    const verified = [];
    for (const [name, meta] of candidates.slice(0, 4)) {
      if (meta.sources.has('user_direction')) {
        verified.push({ name, meta, questions: [] });
        continue;
      }
      const r = await safe(`topic_verify:${name}`, async () =>
        (await withCache(`qverify:${name}`, config.cacheTtl.tagVerify,
          () => searchZhihu(name, 5))).value, []);
      const items = unwrap(r, []);
      const e = errOf(r);
      if (e) { warnings.push(e); continue; }
      if (!items.some((it) => tagMatchesDomain(name, [it?.Title ?? '']))) continue;
      verified.push({ name, meta, questions: items });
    }

    const maxScore = Math.max(...verified.map((v) => v.meta.score), 1);
    const tags = verified.map((v) => {
      const srcs = [...v.meta.sources];
      // 主导信号：按置信度层级取最高的那个
      const primary = srcs.find((s) => SIGNAL_TIER[s] === 'high')
        ?? srcs.find((s) => SIGNAL_TIER[s] === 'medium')
        ?? srcs[0];
      return {
        name: v.name,
        // 冷启动标签置信度本就低，权重上限压到 0.6，避免与实证标签混淆
        weight: Number(
          Math.min(coldStart ? 0.6 : 0.95, 0.35 + 0.6 * (v.meta.score / maxScore)).toFixed(2)
        ),
        source: primary,
        // 方案 5.1：兴趣置信度分层
        confidence_tier: SIGNAL_TIER[primary] ?? 'low',
        contributing_signals: srcs,
        evidence: [
          ...v.meta.evidence,
          ...(v.questions.length
            ? [{ type: 'search_verified', label: v.questions[0].Title?.slice(0, 40) ?? '', url: v.questions[0].Url }]
            : []),
        ],
        _questions: v.questions, // 内部用，输出时剥离
      };
    });

    const coverage = {
      followees: followees.length,
      favorite_lists: favLists.length,
      favorite_items: recentFavs.length,
      own_contents: ownContents.length,
      user_directions: prefs.directions.length,
      feedback_records: fbScores.size,
    };
    const zhihuSignals = followees.length + favLists.length + recentFavs.length + ownContents.length;
    const hasDirection = prefs.directions.length > 0 || manualTags.length > 0;

    let confidence = 'low';
    let reason = '';
    if (hasDirection && zhihuSignals >= 5) {
      confidence = 'high';
      reason = `用户已选择学习方向，并有 ${zhihuSignals} 条知乎行为信号佐证。`;
    } else if (hasDirection) {
      confidence = 'high';
      reason = '用户主动选择了学习方向，按高置信度信号直接采用。';
    } else if (zhihuSignals >= 20) {
      confidence = 'high';
      reason = `知乎行为信号充足（共 ${zhihuSignals} 条），标签均通过搜索话题核验。`;
    } else if (zhihuSignals >= 5) {
      confidence = 'medium';
      reason = `知乎行为信号有限（共 ${zhihuSignals} 条），标签已通过搜索话题核验，但样本偏少。`;
    } else if (coldStart) {
      reason = '账号无可用行为信号，已回退到冷启动预设标签，建议引导用户选择学习方向。';
    } else {
      reason = `知乎行为信号稀疏（共 ${zhihuSignals} 条），平台侧画像同样缺乏样本，置信度低。`;
    }

    return {
      user_ref: userRef,
      generated_at: Math.floor(Date.now() / 1000),
      window_days: config.profileWindowDays,
      summary: tags.length
        ? `兴趣集中在 ${tags.slice(0, 3).map((t) => t.name).join('、')}${tags.length > 3 ? ' 等方向' : ''}。`
        : '暂未识别出稳定兴趣方向。',
      confidence,
      confidence_reason: reason,
      cold_start: coldStart,
      tags: tags.map(({ _questions, ...rest }) => rest),
      // 方案 9.4 兴趣画像页：展示用户主动设置与屏蔽项
      user_preferences: {
        directions: prefs.directions,
        keywords: prefs.keywords,
        goal: prefs.goal,
        blocked: [...blocked],
      },
      platform_recommendation: {
        source: 'question recommend (no query)',
        note: config.profilePlatformProbe
          ? '官方基于账号画像返回的原始结果，未经本应用加工；样本稀疏时可能偏离真实兴趣。'
          : '平台画像探测已关闭（PROFILE_PLATFORM_PROBE 缺省 off：每次探测消耗 1 点 creator 额度），本字段为空数组。',
        items: platformItems.slice(0, 5).map((x) => ({ title: x.Title, url: x.Url })),
      },
      signal_coverage: coverage,
      unavailable_signals: ['browse_history', 'search_history', 'vote_history', 'followed_topics'],
      warnings,
      _tagQuestions: Object.fromEntries(tags.map((t) => [t.name, t._questions])),
      // 原始信号条目：供领域日报计算「依据」，输出前与 _tagQuestions 一样剥离
      _signalItems: { followees, favLists, recentFavs, ownContents },
    };
  });

  return { profile: value, cached };
}

/** 稳定的 user_ref，避免把 uid 直接暴露给前端 */
export function makeUserRef(uid) {
  if (!uid) return 'self';
  return 'u_' + crypto.createHash('sha256').update(String(uid)).digest('hex').slice(0, 16);
}

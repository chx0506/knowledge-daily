// AI 策展流水线（schema 4.0：领域短调研）
//
// 召回原语（搜索 / 推荐问题 / 回答摘要 / 热榜，全部带缓存与并发去重）
//   → 去重 → 质量评分 → 领域调研（直答，含规则降级）→ 校验
//
// 硬规则：AI 只产出 judgement / report / (source_id, why_now)，
// 标题、作者、链接、来源类型一律由后端从召回池取回，保证每条推荐可回溯。
// 直答只做「摘要与归纳」，不作为事实来源；失败时降级到规则版，结构完全一致。
import crypto from 'node:crypto';
import { config } from './config.js';
import { withCache } from './cache.js';
import {
  searchZhihu, fetchQuestionAnswers, recommendQuestions,
  fetchHot, zhidaJson, ZhihuApiError,
} from './zhihu-client.js';
import { DOMAIN_WORKFLOWS } from './workflows.js';

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');
const clip = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
// 硬截断：校验用，保证不超 n 字（clip 会多一个省略号字符）
const hardClip = (t, n) => String(t ?? '').slice(0, n);

// ---------------- 1. 召回原语（全部带 TTL 缓存 + 同 key 并发去重）----------------

export const getSearch = (query) =>
  withCache(`search:${query}`, config.cacheTtl.search, () => searchZhihu(query, 10));
// 画像复查与主领域召回共享同一缓存 key（qrec:${topic}），跨用户复用 creator 池
export const getRecommend = (topic, oauthToken) =>
  withCache(`qrec:${topic}`, config.cacheTtl.questionRecommend,
    () => recommendQuestions({ query: topic, count: 5, oauthToken }));
export const getAnswers = (url) =>
  withCache(`qans:${url}`, config.cacheTtl.questionAnswers,
    () => fetchQuestionAnswers(url, { limit: 5 }));
export const getHot = () =>
  withCache('hot:30', config.cacheTtl.hot, () => fetchHot(30));

/**
 * 篇幅档位（领域引擎与直答 prompt 共用同一定义）：
 * deep     深档：信号强（score ≥ 5 或命中主方向/top tag）→ 500–700 字 + 荐 3 篇
 * standard 标准档：score ≥ 2 → 350–550 字 + 荐 3 篇
 * blind    补盲档：无信号但允许补盲的领域 → 200–300 字 + 荐 2 篇
 */
export const TIER_SPEC = {
  deep: { minWords: 500, maxWords: 700, recs: 3, topicWeight: 0.9 },
  standard: { minWords: 350, maxWords: 550, recs: 3, topicWeight: 0.7 },
  blind: { minWords: 200, maxWords: 300, recs: 2, topicWeight: 0.5 },
};

/** 把一条知乎内容规范化为统一来源对象 */
export function toSource(raw, { topic, kind, question }) {
  const url = raw.Url;
  return {
    source_id: `src_${md5(url).slice(0, 12)}`,
    kind,                                   // search_result | question_answer | personal_favorite | own_content
    topic,
    title: clip(raw.Title ?? question?.title ?? '', 80),
    excerpt: clip(raw.ContentText ?? raw.Summary ?? raw.Excerpt ?? '', 200),
    author: raw.AuthorName ?? '',
    // C1 作者主页：只有接口带回 UrlToken 时才拼 people 链接，否则 null，绝不编造
    author_url: raw.UrlToken ? `https://www.zhihu.com/people/${raw.UrlToken}` : null,
    content_type: raw.ContentType ?? 'answer',
    vote_up_count: raw.VoteUpCount ?? 0,
    comment_count: raw.CommentCount ?? 0,
    // 权威度等级（接口 1–5）：质量评分「可信度」维度的主依据
    authority_level: Number(raw.AuthorityLevel ?? 0) || 0,
    question_title: question?.title ?? '',
    question_url: question?.url ?? '',
    platform: 'zhihu',
    url,
  };
}

// ---------------- 2. 去重 ----------------

/** 去重 Agent：URL 完全相同，或标题+摘要指纹高度相似的视为同一条 */
export function dedupe(sources) {
  const seenUrl = new Set();
  const seenFp = new Set();
  const out = [];
  for (const s of sources) {
    if (seenUrl.has(s.url)) continue;
    const fp = md5(`${s.title}|${s.excerpt.slice(0, 60)}`);
    if (seenFp.has(fp)) continue;
    seenUrl.add(s.url);
    seenFp.add(fp);
    out.push(s);
  }
  return out;
}

// ---------------- 3. 质量与排序 ----------------

/**
 * 质量与传播评分（100 分制）——依据《知乎内容与答主领域标签体系》表 5。
 *
 * 七个维度与满分：信息密度 25 / 可信度 20 / 观点独特性 15 / 争议与讨论度 15 /
 * 故事与情绪 10 / 时效性 10 / 可传播性 5。
 *
 * 接口能拿到的字段有限，每个维度用可得信号做**确定性代理**（口径写在下方注释里）：
 * 不用 AI 打分，同一篇内容任何时候得分一致，可复现、可解释、可对账。
 */
export const QUALITY_DIMENSIONS = [
  { id: 'Q001', name: '信息密度', max: 25 },
  { id: 'Q002', name: '可信度', max: 20 },
  { id: 'Q003', name: '观点独特性', max: 15 },
  { id: 'Q004', name: '争议与讨论度', max: 15 },
  { id: 'Q005', name: '故事与情绪', max: 10 },
  { id: 'Q006', name: '时效性', max: 10 },
  { id: 'Q007', name: '可传播性', max: 5 },
];

const RE_DIGIT = /\d/;
const RE_OPINION = /(认为|其实|误区|反对|不认同|恰恰|真正|未必|并不是|争议|分歧)/;
const RE_STORY = /(我|自己|亲历|经历|那年|当时|后来)/;

function qualityScore(s, maxVote) {
  const text = s.excerpt ?? '';
  // Q001 信息密度：摘要长度 + 是否含数字 + 分句密度（有结构＝信息更密）
  const density = 25 * (
    0.5 * Math.min(1, text.length / 240)
    + 0.2 * (RE_DIGIT.test(text) ? 1 : 0)
    + 0.3 * Math.min(1, (text.match(/[。；，]/g)?.length ?? 0) / 8)
  );
  // Q002 可信度：权威度等级（接口 1–5）；接口未给时，问题下的回答天然带作者背书
  const auth = Number(s.authority_level ?? 0);
  const trust = 20 * (auth >= 1
    ? Math.min(1, auth / 5)
    : (s.kind === 'question_answer' ? 0.6 : 0.4));
  // Q003 观点独特性：含判断/反驳语汇；回答型天然形成观点对照
  const opinion = 15 * (
    0.6 * (RE_OPINION.test(text) ? 1 : 0) + 0.4 * (s.kind === 'question_answer' ? 1 : 0.3)
  );
  // Q004 争议与讨论度：评论/点赞比——高评论低点赞＝有真实分歧
  const votes = Math.max(0, s.vote_up_count ?? 0);
  const comments = Math.max(0, s.comment_count ?? 0);
  const debate = 15 * (votes > 0
    ? Math.min(1, (comments / votes) * 3)
    : (comments > 0 ? 1 : 0));
  // Q005 故事与情绪：第一人称与时间叙事标记
  const story = 10 * (RE_STORY.test(text) ? 1 : 0.3);
  // Q006 时效性：热榜来源视为当下事件；其余给基准分
  const freshness = 10 * (s.kind === 'hot_item' ? 1 : 0.5);
  // Q007 可传播性：点赞量对数归一
  const spread = 5 * (Math.log10(1 + votes) / Math.log10(1 + maxVote));

  const parts = {
    Q001: density, Q002: trust, Q003: opinion, Q004: debate,
    Q005: story, Q006: freshness, Q007: spread,
  };
  const round = (n) => Number(n.toFixed(2));
  return {
    total: round(Object.values(parts).reduce((a, b) => a + b, 0)),
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round(v)])),
  };
}

/**
 * 排序：兴趣匹配 × 0.35 + 质量分（100 制） × 0.65。
 *
 * 与旧式（兴趣.30 + 质量.25 + 时效.15 + 观点.15 + 学习.15）的差别：
 * 时效/观点/故事已经是质量分的独立维度，不再重复计权；
 * 排序理由因此可以按表 5 的口径逐项对账，而不是五个含义模糊的权重。
 */
export function scoreSources(sources, { topicWeight = 0.6 } = {}) {
  const maxVote = Math.max(...sources.map((s) => s.vote_up_count ?? 0), 1);
  return sources.map((s) => {
    const quality = qualityScore(s, maxVote);
    const score = topicWeight * 0.35 + (quality.total / 100) * 0.65;
    return { ...s, _quality: quality, _score: Number(score.toFixed(4)) };
  }).sort((a, b) => b._score - a._score);
}

// ---------------- 4. 领域调研（直答）+ 校验 ----------------

/**
 * 日报角色（D001–D005）——依据《知乎内容与答主领域标签体系》表 6。
 *
 * 每篇推荐原文在报纸里承担一个角色，而不是并列堆三篇。
 * 其中 D003「异议/反方稿」是硬要求：一份只呈现单一结论的报纸不成立。
 */
export const REPORT_ROLES = {
  D001: { key: 'narrative', label: '主叙事', desc: '定义今天在谈什么', required: true },
  D002: { key: 'explainer', label: '专业解释', desc: '解释为什么，提供知识底座', required: true },
  D003: { key: 'dissent', label: '异议', desc: '提供冲突，避免单一结论', required: true },
  D004: { key: 'experience', label: '个体经验', desc: '把抽象议题落到真实的人', required: false },
  D005: { key: 'trend', label: '趋势延伸', desc: '把当下问题连接未来', required: false },
};

const ROLE_IDS = Object.keys(REPORT_ROLES);

/** 角色分配兜底：AI 未给或给重时，按质量分顺位补一个尚未占用的必需角色 */
function fillRoles(recs, tierSpec) {
  const used = new Set(recs.map((r) => r.role).filter(Boolean));
  const pending = ROLE_IDS.filter((id) => REPORT_ROLES[id].required && !used.has(id));
  return recs.map((r) => {
    if (r.role && ROLE_IDS.includes(r.role)) return r;
    const id = pending.shift() ?? 'D001';
    return { ...r, role: id };
  });
}

function sourceDigestForPrompt(sources, limit = 8) {
  return sources.slice(0, limit).map((s, i) =>
    `[${i + 1}] id=${s.source_id} 来源类型=${s.source_type ?? '搜索'}\n标题：${s.title}\n摘要：${s.excerpt}`
  ).join('\n\n');
}

/** 补齐推荐：AI 给的 id 悬空或篇数不足时，用评分最高的池内条目 + 模板文案补齐 */
function fillRecommended(recs, sources, tierSpec) {
  const out = [...recs];
  for (const s of sources) {
    if (out.length >= tierSpec.recs) break;
    if (out.some((r) => r.source_id === s.source_id)) continue;
    out.push({
      source_id: s.source_id,
      why_now: `本领域今日质量评分第 ${sources.indexOf(s) + 1} 的原文，值得一读。`,
    });
  }
  return out.slice(0, tierSpec.recs);
}

/**
 * 领域调研（直答版）：产出 judgement + report + recommended(source_id, why_now)。
 * 依据数字由后端算好随 prompt 注入，AI 不许编数字；校验时剔除悬空引用。
 */
export async function curateDomainAI({ def, tierSpec, signals, breakdown, sources, crossCtx = null }) {
  // F1：按领域工作流注入拆解提示（无工作流的临时领域用通用角度）
  const wfHint = DOMAIN_WORKFLOWS[def.workflow]?.promptHint ?? '';
  // 任务四：关联拓展补盲的交叉视角说明（锚标签 × 领域），禁元评论等校验规则不变
  const crossHint = crossCtx
    ? `交叉视角说明：本版为关联拓展，从用户兴趣「${crossCtx.anchor}」视角看「${crossCtx.domainName}」：材料召回围绕两者的交叉地带，写作时保持这一交叉视角，就事论事写材料反映的市面进展。\n`
    : '';
  const prompt = `你在为一份个性化「领域日报」撰写今日短调研。领域：${def.name}
本领域只调研：${def.angle}
${wfHint ? `拆解提示：${wfHint}\n` : ''}${crossHint}依据数字（后端真实统计，正文中如需引用只能用这些，禁止编造其他数字）：
- 信号依据：相关关注创作者 ${signals.followees} 位、相关收藏夹 ${signals.favorite_lists} 个、相关收藏 ${signals.favorite_items} 篇、本人相关创作 ${signals.own_contents} 篇、相关学习方向 ${signals.directions} 个
- 今日综合知乎 ${sources.length} 篇（搜索 ${breakdown.search} 篇、个人内容 ${breakdown.personal} 篇、问题回答 ${breakdown.question_answers} 篇）

以下知乎原文按质量排序，每条有唯一 id 与来源类型：
${sourceDigestForPrompt(sources)}

请严格基于以上材料，输出如下 JSON（不要编造材料之外的事实、数字或链接）：
{
  "judgement": "今日判断一句话，≤40字",
  "report": "短调研正文，恰好 3 段，${tierSpec.minWords}-${tierSpec.maxWords} 字，段与段之间空一行。写给「你」：只说市面上这件事进展到哪、有哪几派经验、对你意味着什么",
  "recommended": [{ "source_id": "上文出现过的 id", "why_now": "为什么现在读，≤40字", "role": "D001|D002|D003|D004|D005" }]
}
推荐要按「日报角色」分配，而不是并列堆几篇：
  D001 主叙事稿——定义今天在谈什么（故事线完整的事件/人物/现象）
  D002 专业解释稿——解释为什么，提供知识底座（有数据或机制解释）
  D003 异议/反方稿——**必须有一篇**：与主叙事存在真实分歧或相反立场
  D004 个体经验稿——一手经历，把抽象议题落到真实的人（可选）
  D005 趋势延伸稿——把当下问题连接未来（可选）
要求：recommended 给 ${tierSpec.recs} 篇，只荐高质量、有经验或有分歧的；所有 source_id 必须来自上面出现过的 id。judgement 与 report 只写领域内容本身（市面进展、经验派别、对你的意义），禁止评论信号强弱、依据数字、选题面宽窄、材料与你的交集有无这类元信息；材料与用户兴趣关系弱时，就事论事写材料反映的市面进展即可。`;

  const raw = await zhidaJson(prompt, { model: 'zhida-fast-1p5', timeoutMs: 50000 });

  // 校验 Agent：judgement ≤60 字截断、report ≤800 字截断、悬空 source_id 剔除
  const judgement = hardClip(clip(raw.judgement ?? '', 60), 60);
  const report = hardClip(clip(raw.report ?? '', 800), 800);
  if (!judgement || report.length < 120) {
    throw new ZhihuApiError('直答返回内容不完整，已降级到规则版');
  }

  const pool = new Set(sources.map((s) => s.source_id));
  const seen = new Set();
  const recs = (Array.isArray(raw.recommended) ? raw.recommended : [])
    .filter((r) => r && pool.has(r.source_id) && !seen.has(r.source_id) && seen.add(r.source_id))
    .map((r) => {
      const role = ROLE_IDS.includes(String(r.role ?? '').trim()) ? String(r.role).trim() : null;
      return { source_id: r.source_id, why_now: clip(r.why_now ?? '', 60), role };
    })
    .filter((r) => r.why_now);

  return {
    judgement,
    report,
    recommended: fillRoles(fillRecommended(recs, sources, tierSpec), tierSpec),
    generated_by: 'zhida',
  };
}

/**
 * 领域调研（规则降级版）：直答失败 / 超时 / ai=false 时使用。
 * judgement 用 lead question 或 top source 标题；report 用 top 来源摘要拼接成三段；
 * recommended 取评分 top N + 模板 why_now。结构与 AI 版完全一致。
 */
export function curateDomainRule({ def, tierSpec, sources, leadQuestion }) {
  const top = sources.slice(0, 5);
  const judgement = hardClip(clip(
    leadQuestion?.title || top[0]?.title || `${def.name}领域今日值得关注的内容`, 60), 60);

  const paraOf = (s, lead) => {
    const via = s.source_type && s.source_type !== '搜索' ? `（来自你的${s.source_type}）` : '';
    return `${lead}《${clip(s.title, 40)}》${via}：${clip(s.excerpt, 110) || '（暂无摘要）'}`;
  };
  const p1 = top[0] ? paraOf(top[0], '今天最值得关注的是') : '';
  const p2 = top.slice(1, 3).map((s) => paraOf(s, '同时，')).join('\n\n');
  const p3 = `${top.slice(3, 5).map((s) => paraOf(s, '另外，')).join('')}`
    + `以上为规则版摘要（直答暂不可用），今日「${def.name}」领域共综合 ${sources.length} 篇知乎原文，结论与链接均可回溯到原文。`;

  let report = [p1, p2, p3].filter(Boolean).join('\n\n');
  // 篇幅兜底：召回稀少导致过短时继续补摘要，凑足档位下限的可读长度
  let i = 5;
  while (report.length < tierSpec.minWords && i < sources.length) {
    report += `\n\n${paraOf(sources[i], '补充，')}`;
    i += 1;
  }
  if (report.length < 200) {
    report += '\n\n（本领域今日召回内容有限，建议稍后重新生成以获取更完整的调研。）';
  }

  return {
    judgement,
    report: hardClip(clip(report, 800), 800),
    // 规则版按顺位覆盖三个必需角色，结构与 AI 版一致（含异议位，避免单一结论）
    recommended: sources.slice(0, tierSpec.recs).map((s, idx) => ({
      source_id: s.source_id,
      why_now: `今日「${def.name}」领域评分第 ${idx + 1} 的原文，建议先读。`,
      role: ROLE_IDS[idx] ?? 'D001',
    })),
    generated_by: 'rule_fallback',
  };
}

// 领域引擎（schema 4.0）
//
// 设计依据（产品文案）：领域页不是新闻频道，而是「按你的画像编出来的短调研」。
// 固定 6 个领域 Tab（另有「推荐」聚合页），每个领域只调研一个角度：
//   依据打分 → 收录与篇幅档位 → 召回（配额纪律）→ 领域调研 → 校验组装
// 没依据的领域当天不生成（列入 skipped）；篇幅跟画像置信度走，不跟频道编制走。
import {
  getSearch, getHot,
  toSource, dedupe, scoreSources, curateDomainAI, curateDomainRule, TIER_SPEC,
} from './curator.js';
import { DOMAIN_WORKFLOWS } from './workflows.js';

const clip = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

// ---------------- 1. 领域定义 ----------------

/**
 * 领域目录（D1 动态领域）：候选领域按需扩充，打分与收录规则不变。
 * allowBlind=false 的领域无信号则跳过（进 skipped_domains）；
 * world 额外允许热榜驱动补盲（热榜只用于发现议题，不进 source 池、不进判断）。
 *
 * 每个领域含：关键词集（画像信号匹配）、defaultQuery（无信号补盲时的默认
 * 检索词，即 allowBlind 的落地方式）、workflow（src/workflows.js 的工作流引用）。
 * 画像无相关信号时新领域得分 < 2，自动退回原有 6 领域行为。
 */
export const DOMAINS = [
  {
    id: 'tech', name: '科技',
    angle: '你所在的产品/工具市场进展到哪',
    keywords: ['AI', '产品', 'Agent', '工具', '模型', '互联网', '开发', '设计', '编程',
      '大模型', '人工智能', '软件', '开源', '算法', 'App', '创业'],
    defaultQuery: 'AI 产品',
    workflow: 'tech',
    allowBlind: true,
  },
  {
    id: 'finance', name: '财经',
    angle: '这件事怎么变成一笔可解释的钱',
    keywords: ['财经', '成本', '预算', '订阅', '付费', '收入', '变现', '股票', '基金', '降本',
      '市场', '政策', '公司', '投资', '理财', '经济', '消费', '财报'],
    defaultQuery: '财经 市场 公司',
    workflow: 'finance',
    allowBlind: true,
  },
  {
    id: 'china', name: '国内',
    angle: '工作变化如何改居住和在场',
    keywords: ['城市', '居住', '房租', '县城', '回流', '远程', '编制', '就业', '杭州', '成都',
      '落户', '买房', '一线', '二线', '育儿', '北漂'],
    defaultQuery: '城市 居住 就业',
    workflow: 'china',
    allowBlind: false,
  },
  {
    id: 'world', name: '国际',
    angle: '外部讨论如何反衬你的流程问题',
    keywords: ['国际', '美国', '海外', '全球', '硅谷', '科技公司',
      '欧洲', '日本', '出海', '外企', '贸易', '汇率'],
    defaultQuery: '国际 科技公司',
    workflow: 'world',
    allowBlind: true,
  },
  {
    id: 'life', name: '生活',
    angle: '工作闭环征走了哪一块身体',
    keywords: ['睡眠', '加班', '专注', '通勤', '健康', '焦虑', '休息', '晚上',
      '情绪', '运动', '失眠', '冥想', '健身', '饮食', '抑郁'],
    defaultQuery: '睡眠 专注 健康',
    workflow: 'life',
    allowBlind: false,
  },
  {
    id: 'culture', name: '文化',
    angle: '用什么方法把判断留在自己手里',
    keywords: ['阅读', '重读', '书', '文化', '学习方法', '收藏夹', '完读',
      '红楼梦', '文学', '小说', '读书', '诗歌', '历史', '哲学', '影视', '电影', '艺术'],
    defaultQuery: '阅读 学习方法',
    workflow: 'culture',
    allowBlind: false,
  },
  {
    id: 'gaming', name: '游戏',
    angle: '新作、行业动态与玩家社区在聊什么',
    keywords: ['游戏', '电竞', '玩家', '主机游戏', 'Steam', '塞尔达', '独立游戏', '手游',
      '单机', '网游', '任天堂', '黑神话', '二次元', 'PS5'],
    defaultQuery: '游戏 新作',
    workflow: 'gaming',
    allowBlind: false,
  },
  {
    id: 'design', name: '设计',
    angle: '作品、趋势与工具如何改变设计交付',
    keywords: ['设计', '交互', '视觉', 'UI', 'UX', 'CMF', '作品集', '设计师',
      '平面', '字体', '海报', '品牌', '配色', '排版', '插画'],
    defaultQuery: '设计 趋势 作品',
    workflow: 'design',
    allowBlind: false,
  },
  {
    id: 'science', name: '科学',
    angle: '论文热点、科普解释与科学争议',
    keywords: ['科学', '论文', '物理', '生物', '天文', '科普', '实验',
      '数学', '化学', '医学', '基因', '量子', '宇宙', '气候', '研究'],
    defaultQuery: '科学 研究 论文',
    workflow: 'science',
    allowBlind: false,
  },
  {
    id: 'travel', name: '旅行',
    angle: '目的地、攻略与旅行行业变化',
    keywords: ['旅行', '目的地', '攻略', '出行', '徒步', '自驾', '冰岛', '机票',
      '旅游', '酒店', '露营', '签证', '行程', '高铁', '小众'],
    defaultQuery: '旅行 目的地 攻略',
    workflow: 'travel',
    allowBlind: false,
  },
];

const EMPTY_SIGNALS = { followees: [], favLists: [], recentFavs: [], ownContents: [] };

/**
 * 关键词匹配（单向：信号文本包含关键词；英文大小写不敏感）。
 * 曾用双向包含（k.includes(t)），导致画像 tag「科技」被 world 词表的
 * 「科技公司」反向吸入、误收录国际版——反向匹配对短通用词不可靠，禁用。
 */
function matchesAny(text, keywords) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return keywords.some((kw) => t.includes(kw.toLowerCase()));
}

/**
 * 标签 ↔ 领域关键词：双向子串匹配（任务三，仅此一路使用）。
 * tag 含 keyword 或 keyword 含 tag 即命中；两侧最小长度 2 才参与，避免单字误配。
 * 背景：切词修复后画像产出的是「红楼梦」这类短实体标签，单向匹配（tag 含 keyword）
 * 永远打不中同长或更长的领域词，导致强文化信号的领域得 0 分。
 * 已知误伤面：短通用 tag（如「科技」）会被更长的领域词（如「科技公司」）反向吸入，
 * 通过 length≥2 与词库收敛控制，残余场景见任务三报告。
 */
// 任务五：同时导出给 profile.js 的标签搜索核验复用（同一套双向子串规则，不再造第二套）
export function tagMatchesDomain(tagName, keywords) {
  const t = String(tagName ?? '').toLowerCase();
  if (t.length < 2) return false;
  return keywords.some((kw) => {
    const k = String(kw).toLowerCase();
    if (k.length < 2) return false;
    return t.includes(k) || k.includes(t);
  });
}

// ---------------- 2. 依据打分与收录档位 ----------------

/**
 * 依据打分：扫描画像原始信号 + 用户主动偏好 + 画像标签，按关键词子串匹配累计。
 * 权重：directions×3、keywords×1、收藏夹×2、收藏内容×1、本人创作×1、关注签名×0.5、画像 tag×2
 * （keywords 比 directions 粒度细、置信度低，取较低权重）
 *
 * 收录与档位：
 *   score ≥ 5 或命中用户主方向/top tag → deep（500–700 字 + 荐 3 篇）
 *   score ≥ 2                          → standard（350–550 字 + 荐 3 篇）
 *   其余 tech/finance/world 可补盲      → blind（200–300 字 + 荐 2 篇）
 *   china/life/culture 无信号则跳过
 * score 最高的已收录领域为「主领域」。
 *
 * 任务四 blind 开关：blind=false 时不做任何补盲——allowBlind 领域无信号
 * 同样进 skipped（原因与 allowBlind=false 领域一致：「无信号依据，今日未生成」），
 * 即「只看我的方向」模式。
 */
/**
 * Web 端（schema 4.0 渲染层）当前支持的领域 id 白名单。
 *
 * 前端 `src/data/remote/types.ts` 的 `RemoteDomainId` 只声明了这 6 个；
 * `src/data/remote/map.ts` 的 `mapId()` 对未知 id 静默兜底为 `"tech"`
 * （`REMOTE_TO_FRONT_DOMAIN[remoteId] ?? "tech"`）。
 *
 * 若后端把 gaming / design / science / travel 投递给前端，它们会在
 * 「生成的领域报告」与「skipped 列表」两处都被渲染成「科技」（名称对、id 错），
 * 领域 tab、图标与配色随之串位。
 *
 * 因此这里只从白名单内选取领域投递 —— **领域目录 `DOMAINS` 本身保持 10 个不变**，
 * 打分、工作流、召回全部不动，仅限制"哪些领域会被投递给 Web 前端"。
 *
 * 前端补齐 `RemoteDomainId` / `REMOTE_TO_FRONT_DOMAIN` 后，在下面的默认值里
 * 加入新 id 即可放开；也可用 `ZHIHU_WEB_DOMAINS=all` 临时放开全部 10 个领域
 * （供已适配的前端联调用，无需改代码）。
 */
const WEB_DOMAIN_IDS = new Set(
  (process.env.ZHIHU_WEB_DOMAINS ?? 'tech,finance,china,world,life,culture')
    .split(',').map((s) => s.trim()).filter(Boolean),
);

/** 实际会投递给 Web 前端的领域定义列表（`ZHIHU_WEB_DOMAINS=all` 时等于完整目录）。 */
export const webDomainCatalog = () =>
  (process.env.ZHIHU_WEB_DOMAINS === 'all' ? DOMAINS : DOMAINS.filter((d) => WEB_DOMAIN_IDS.has(d.id)));

export function scoreDomains(profile, prefs, { blind = true } = {}) {
  const si = profile._signalItems ?? EMPTY_SIGNALS;
  const tags = profile.tags ?? [];
  const topTagName = tags[0]?.name ?? '';

  const ctxs = webDomainCatalog().map((def) => {
    const matched = {
      directions: (prefs.directions ?? []).filter((d) => matchesAny(d, def.keywords)),
      keywords: (prefs.keywords ?? []).filter((k) => matchesAny(k, def.keywords)),
      tags: tags.filter((t) => tagMatchesDomain(t.name, def.keywords)),
      favLists: si.favLists.filter((x) => matchesAny(x.Title, def.keywords)),
      favItems: si.recentFavs.filter((x) => matchesAny(x.Title, def.keywords)),
      ownContents: si.ownContents.filter((x) => matchesAny(x.Title, def.keywords)),
      followees: si.followees.filter((x) => matchesAny(x.Headline, def.keywords)),
    };
    const score =
      matched.directions.length * 3 +
      matched.keywords.length * 1 +
      matched.favLists.length * 2 +
      matched.favItems.length * 1 +
      matched.ownContents.length * 1 +
      matched.followees.length * 0.5 +
      matched.tags.length * 2;

    const hitMain = matched.directions.length > 0
      || (topTagName ? tagMatchesDomain(topTagName, def.keywords) : false);

    let tier = null; let included = false; let skipReason = null;
    if (score >= 2) {
      included = true;
      tier = (score >= 5 || hitMain) ? 'deep' : 'standard';
    } else if (def.allowBlind && blind) {
      included = true;
      tier = 'blind';
    } else {
      skipReason = '无信号依据，今日未生成';
    }

    return {
      def, matched, hitMain, tier, included, skipReason,
      score: Number(score.toFixed(2)),
      isMain: false,
    };
  });

  // 主领域：已收录领域中分数最高（并列取 DOMAINS 顺序靠前者）
  const included = ctxs.filter((c) => c.included);
  if (included.length) {
    const main = included.reduce((a, b) => (b.score > a.score ? b : a));
    main.isMain = true;
  }
  return ctxs;
}

// ---------------- 3. 召回（配额纪律）----------------

/**
 * 关联拓展补盲的锚标签（任务四）：
 * 取画像 weight ≥ 0.5 的前 3 个标签。阈值依据：weight = 0.35 + 0.6×(score/maxScore)，
 * 0.5 对应 score ≥ 0.25×max，即「至少达到最强候选四分之一」的中置信度下沿，
 * 能把验证都没通过的尾部噪声标签挡在锚之外；取 3 个是为交叉组合留候选，
 * 当前交叉 query 只用第 1 个（最强锚）。
 */
function pickAnchorTags(profile) {
  return (profile?.tags ?? [])
    .filter((t) => (t.weight ?? 0) >= 0.5 && String(t.name ?? '').length >= 2)
    .slice(0, 3)
    .map((t) => t.name);
}

/**
 * 查询构造（F1：按领域工作流的 query 列表）：
 * - 补盲档（无信号）任务四起分两种模式：
 *   · profile_anchored：有可用锚标签时，query = 锚标签 × 领域交叉角度词
 *     （workflows.crossAngles），如「红楼梦 数字人文」——补盲内容贴着用户兴趣拓展；
 *   · cold_start：真冷启动（无标签）回退领域默认 query，行为与此前一致。
 *   模式记录在 ctx.blindMode / ctx.blindAnchor，供 basis 文案与 blind_mode 字段使用。
 * - 有信号：命中的画像 tag（≤2 个，无命中时用 top tag）+ 工作流首选 query
 */
function buildQuery(ctx, profile) {
  const wf = DOMAIN_WORKFLOWS[ctx.def.workflow];
  if (ctx.tier === 'blind') {
    const anchors = pickAnchorTags(profile);
    const cross = wf?.crossAngles?.[0];
    if (anchors.length && cross) {
      ctx.blindMode = 'profile_anchored';
      ctx.blindAnchor = anchors[0];
      return `${anchors[0]} ${cross}`;
    }
    ctx.blindMode = 'cold_start';
    return ctx.def.defaultQuery ?? wf?.queries?.[0] ?? ctx.def.keywords.slice(0, 2).join(' ');
  }
  const hitTags = ctx.matched.tags.map((t) => t.name);
  const tagPart = (hitTags.length ? hitTags : (profile?.tags?.[0] ? [profile.tags[0].name] : []))
    .slice(0, 2);
  const base = wf?.queries?.[0] ?? ctx.def.defaultQuery ?? ctx.def.keywords.slice(0, 2).join(' ');
  return [...tagPart, base].join(' ');
}

/**
 * 领域召回。纪律（任务五：creator 池消耗归零）：
 * - 不再调用 question recommend / answers（creator/question_answers 池）；
 *   召回池丰富度由搜索补足：blind 档追加工作流第二角度 query（1→2 次），
 *   standard 1 次、deep 2 次（预算不变）
 * - world：用共享缓存的热榜发现议题，相关热榜标题作为 search 查询词；热榜条目不进 source 池
 * - 个人内容入池：recentFavs / ownContents 标题命中领域关键词的条目（各最多 3 条）
 */
async function recallDomain(ctx, { profile, signalItems, oauthToken, warnings }) {
  const { def } = ctx;
  const raw = [];
  let hotIssue = null;

  // 个人内容入池（需有真实 URL，最多各 3 条）
  const personal = [
    ...ctx.matched.favItems.slice(0, 3).map((it) => ({ it, kind: 'personal_favorite' })),
    ...ctx.matched.ownContents.slice(0, 3).map((it) => ({ it, kind: 'own_content' })),
  ];
  for (const { it, kind } of personal) {
    if (!String(it.Url ?? '').startsWith('http')) continue;
    raw.push(toSource(it, { topic: def.name, kind }));
  }

  let query = ctx.query ?? buildQuery(ctx, profile);

  // world：热榜只用于发现议题，且议题必须能回连用户画像
  //（文案：国际版「只写会传回她工作方式的那一条」）；
  // 补盲档找不到相关议题时当天不生成，不硬凑一份与用户无关的国际新闻。
  if (def.id === 'world') {
    try {
      const { value: hot } = await getHot();
      const userTerms = [
        ...(profile?.tags ?? []).flatMap((t) => [t.name, ...String(t.name).split(/\s+/)]),
        ...(profile?.user_preferences?.directions ?? []),
      ].filter(Boolean);
      const hit = hot.find((h) => matchesAny(h.Title, def.keywords)
        && userTerms.some((t) => matchesAny(h.Title, [t])));
      if (hit?.Title) {
        hotIssue = clip(hit.Title, 40);
        query = clip(hit.Title, 40);
      } else if (ctx.tier === 'blind') {
        ctx.skipNote = '今日热榜议题与你的画像无交集，未生成';
        return { raw: [], hotIssue: null, query };
      }
    } catch (err) {
      warnings.push(`recall.hot(${def.id}): ${err.message}`);
    }
  }

  // 每个领域按工作流 query 列表搜索（按 query 缓存），任务五成本模型：
  // standard 1 次；deep 追加第二角度（2 次，不变）；blind 也追加第二角度（1→2 次，
  // 补足 recommend 移除后的召回池丰富度）——配额纪律不并发放大
  const wf = DOMAIN_WORKFLOWS[def.workflow];
  const queries = [query];
  if ((ctx.tier === 'deep' || ctx.tier === 'blind') && wf?.queries?.[1] && wf.queries[1] !== query) {
    queries.push(wf.queries[1]);
  }
  for (const q of [...new Set(queries)]) {
    try {
      const { value: items } = await getSearch(q);
      for (const it of items) raw.push(toSource(it, { topic: def.name, kind: 'search_result' }));
    } catch (err) {
      warnings.push(`recall.search(${def.id}): ${err.message}`);
    }
  }

  return { raw, hotIssue, query };
}

/**
 * 来源标注交叉引用（真实计算，禁止 AI 编来源）：
 * URL 命中 recentFavs → 收藏；URL 命中 ownContents → 创作；
 * 作者名命中 followees → 关注；否则 → 搜索。
 */
function tagSourceTypes(sources, signalItems) {
  const favUrls = new Set((signalItems.recentFavs ?? []).map((i) => i.Url).filter(Boolean));
  const ownUrls = new Set((signalItems.ownContents ?? []).map((i) => i.Url).filter(Boolean));
  const followeeNames = new Set((signalItems.followees ?? []).map((f) => f.Fullname).filter(Boolean));
  for (const s of sources) {
    if (favUrls.has(s.url)) s.source_type = '收藏';
    else if (ownUrls.has(s.url)) s.source_type = '创作';
    else if (s.author && followeeNames.has(s.author)) s.source_type = '关注';
    else s.source_type = '搜索';
  }
}

// ---------------- 4. 依据文案（模板生成，数字真实）----------------

function buildBasisText(ctx, { total, breakdown, hotIssue }) {
  const { def, matched, tier } = ctx;
  const parts = [];
  if (matched.followees.length) {
    const names = matched.followees.slice(0, 2).map((f) => f.Fullname).filter(Boolean).join('、');
    parts.push(`你关注的 ${matched.followees.length} 位相关创作者${names ? `（${names}）` : ''}`);
  }
  if (matched.favLists.length) {
    parts.push(`收藏夹「${matched.favLists[0].Title}」等 ${matched.favLists.length} 个相关收藏夹`);
  }
  if (matched.favItems.length) parts.push(`近期收藏的 ${matched.favItems.length} 篇相关内容`);
  if (matched.ownContents.length) parts.push(`本人创作的 ${matched.ownContents.length} 篇相关内容`);
  if (matched.directions.length) parts.push(`学习方向「${matched.directions[0]}」`);
  if (matched.tags.length) parts.push(`画像标签「${matched.tags[0].name}」`);

  // 任务四：关联拓展补盲如实说明锚标签（即使存在零星弱信号，「没有明显直接信号」仍成立）；
  // 其余 blind 沿用原补盲文案；有信号领域维持信号说明。
  const head = tier === 'blind' && ctx.blindMode === 'profile_anchored'
    ? `你没有明显的「${def.name}」直接信号，依据你的「${ctx.blindAnchor}」兴趣做了关联拓展。`
    : parts.length
      ? `根据${parts.join('、')}，判断你在「${def.name}」领域有持续信号。`
      : `你没有明显的「${def.name}」个人信号，本版为补盲内容，篇幅从短。`;
  const body = `今日综合知乎 ${total} 篇（搜索 ${breakdown.search}、个人内容 ${breakdown.personal}、问题回答 ${breakdown.question_answers}）。`;
  const hot = hotIssue ? `热榜仅用于发现议题「${hotIssue}」，未进入判断。` : '';
  const blind = tier === 'blind' && parts.length ? '信号较弱，本版为补盲篇幅。' : '';
  return head + body + hot + blind;
}

// ---------------- 5. 单领域日报组装 ----------------

/**
 * 生成一个领域的日报。
 * @param {object} ctx scoreDomains 产出的领域上下文（主动策展时可手工构造）
 * @returns 领域日报对象；召回为空时返回 null（调用方列入 skipped）
 */
export async function buildDomainReport(ctx, {
  profile = null, signalItems = EMPTY_SIGNALS, oauthToken = null,
  useAI = true, warnings = [],
} = {}) {
  const { def, tier } = ctx;
  const tierSpec = TIER_SPEC[tier] ?? TIER_SPEC.standard;

  // 召回 → 去重 → 质量评分 → 来源标注
  const { raw, hotIssue } = await recallDomain(ctx, {
    profile, signalItems, oauthToken, warnings,
  });
  const pool = dedupe(raw);
  if (!pool.length) return null;
  tagSourceTypes(pool, signalItems);
  const scored = scoreSources(pool, { topicWeight: tierSpec.topicWeight });

  const breakdown = {
    search: scored.filter((s) => s.kind === 'search_result').length,
    personal: scored.filter((s) => s.kind === 'personal_favorite' || s.kind === 'own_content').length,
    question_answers: scored.filter((s) => s.kind === 'question_answer').length,
  };
  const signals = {
    followees: ctx.matched.followees.length,
    favorite_lists: ctx.matched.favLists.length,
    favorite_items: ctx.matched.favItems.length,
    own_contents: ctx.matched.ownContents.length,
    directions: ctx.matched.directions.length + ctx.matched.keywords.length,
  };

  // 领域调研（直答，失败降级规则版；结构完全一致）
  // 任务四：关联拓展补盲时把交叉视角（锚标签 × 领域）注入直答 prompt
  const crossCtx = tier === 'blind' && ctx.blindMode === 'profile_anchored'
    ? { anchor: ctx.blindAnchor, domainName: def.name }
    : null;
  let curated;
  if (useAI) {
    try {
      curated = await curateDomainAI({ def, tierSpec, signals, breakdown, sources: scored, crossCtx });
    } catch (err) {
      warnings.push(`curate.ai(${def.id}) 已降级到规则版: ${err.message}`);
      // 任务五：lead question 来源（recommend+answers）已移除，规则版 judgement 用 top 来源兜底
      curated = curateDomainRule({ def, tierSpec, sources: scored, leadQuestion: null });
    }
  } else {
    curated = curateDomainRule({ def, tierSpec, sources: scored, leadQuestion: null });
  }

  // AI 只给 source_id 与 why_now；标题 / 作者 / 链接 / 来源类型从池中取回，保证链接真实
  const byId = new Map(scored.map((s) => [s.source_id, s]));
  const recommended = curated.recommended
    .map((r) => {
      const s = byId.get(r.source_id);
      return s ? {
        source_id: s.source_id, title: s.title, author: s.author,
        author_url: s.author_url ?? null,   // C1：无 UrlToken 时为 null，绝不编造
        source_type: s.source_type, why_now: r.why_now, url: s.url,
      } : null;
    })
    .filter(Boolean);
  const citedIds = new Set(recommended.map((r) => r.source_id));

  return {
    domain_id: def.id,
    name: def.name,
    tier,
    // 任务四：补盲领域标注召回模式（关联拓展 / 真冷启动），仅 tier=blind 时出现
    ...(tier === 'blind' ? { blind_mode: ctx.blindMode ?? 'cold_start' } : {}),
    basis: {
      text: buildBasisText(ctx, { total: scored.length, breakdown, hotIssue }),
      signals,
      synthesized_count: scored.length,
      breakdown,
      hot_discovery_only: def.id === 'world' && tier === 'blind',
    },
    judgement: curated.judgement,
    report: curated.report,
    recommended,
    source_index: scored.map((s) => ({
      source_id: s.source_id, title: s.title, source_type: s.source_type,
      author_url: s.author_url ?? null,
      url: s.url, cited: citedIds.has(s.source_id),
    })),
    generated_by: curated.generated_by,
  };
}

/** 主动策展：构造临时领域（standard 档，走搜索召回），复用领域引擎 */
export function makeCustomDomainCtx(topic) {
  return {
    def: {
      id: 'custom', name: topic,
      angle: `围绕「${topic}」做一次专题短调研`,
      keywords: [topic], allowBlind: true,
    },
    matched: {
      directions: [], keywords: [], tags: [], favLists: [],
      favItems: [], ownContents: [], followees: [],
    },
    score: 0, hitMain: false, tier: 'standard',
    included: true, skipReason: null, isMain: true,
    query: topic,
  };
}

export { EMPTY_SIGNALS };

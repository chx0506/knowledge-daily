// 领域日报组装（schema 4.0）
//
// 设计依据（产品文案）：领域页不是新闻频道，而是按用户画像编出来的短调研。
// 每份领域日报只做三件事：
//   ① 有数据表示（真实信号依据 + 综合篇数）
//   ② 今日判断 + 400–700 字短调研（篇幅跟画像置信度走）
//   ③ 几篇值得看的原文（来源 / 为什么现在读 / 链接）
// 「推荐」页为主线聚合：主领域判断 + 先读哪一版 + 全量统计（后端计算，非 AI 编造）。
import { config } from './config.js';
import { withCache, cacheGetStale, cacheGetStaleByPrefix, cacheSet } from './cache.js';
import { ZhihuApiError, apiCallContext, newApiCallCounter } from './zhihu-client.js';
import { buildProfile } from './profile.js';
import { scoreDomains, buildDomainReport, makeCustomDomainCtx, EMPTY_SIGNALS } from './domains.js';
import { getPreferences, getFeedbacks, FEEDBACK_WEIGHTS } from './preferences.js';

const today = () => new Date().toISOString().slice(0, 10);

/** B2：从日报结果汇总来源篇数（复用各领域 breakdown，不另起炉灶重复统计） */
function sumSources(dailyValue) {
  const s = { search: 0, personal: 0, question_answers: 0 };
  for (const x of dailyValue?.domains ?? []) {
    s.search += x.basis?.breakdown?.search ?? 0;
    s.personal += x.basis?.breakdown?.personal ?? 0;
    s.question_answers += x.basis?.breakdown?.question_answers ?? 0;
  }
  return { ...s, total: s.search + s.personal + s.question_answers };
}

/**
 * 生成完整领域日报（schema 4.0）。
 * @param {number} maxDomains 最多生成几个领域（1–目录上限，默认 3；主领域恒在生成清单内）
 */
export async function buildDaily({
  oauthToken = null, userRef = 'self', manualTags = [],
  useAI = true, maxDomains = 3, force = false, blind = true,
} = {}) {
  const prefs = getPreferences(userRef);
  // 缓存戳含偏好与反馈记录数/权重总和：任何反馈变化都会重新生成（与画像缓存同一纪律）
  const fbList = getFeedbacks(userRef);
  const fbWeightSum = fbList.reduce((s, f) => s + (FEEDBACK_WEIGHTS[f.feedback] ?? 0), 0);
  const stamp = `${prefs.updatedAt}:${fbList.length}:${fbWeightSum}:${useAI ? 'ai' : 'rule'}:${maxDomains}`;
  // 任务四：blind 段提到 key 前部——blind=0/1 的日报缓存完全隔离（含 force 写回），
  // stale 降级按前缀回退时也只在同一 blind 档内找上一期，
  // 避免「只看我的方向」模式配额耗尽时退回一份含补盲的日报。
  const blindSeg = blind ? 'b1' : 'b0';
  const cacheKey = `daily:v4:${userRef}:${blindSeg}:${manualTags.join(',')}:${stamp}`;
  // 用户点「重新生成」时跳过缓存，但仍保留旧值用于失败回退
  const forceKey = force ? `${cacheKey}:${Date.now()}` : cacheKey;

  // B2：本次请求的可观测性上下文（耗时 + API 调用计数，缓存命中时自然归零）
  const t0 = performance.now();
  const apiCounter = newApiCallCounter();
  const steps = { profile_ms: 0, domains_ms: 0, mainline_ms: 0 };
  const metricsOf = (value) => ({
    total_ms: Math.round(performance.now() - t0),
    steps: { ...steps },
    api_calls: { total: apiCounter.total, by_endpoint: { ...apiCounter.byEndpoint } },
    sources: sumSources(value),
  });

  try {
    const { value, cached } = await apiCallContext.run(apiCounter, () =>
      withCache(forceKey, config.cacheTtl.daily, async () => {
        const tProfile = performance.now();
        const { profile } = await buildProfile({ oauthToken, userRef, manualTags });
        steps.profile_ms = Math.round(performance.now() - tProfile);
        const warnings = [...(profile.warnings ?? [])];
        const signalItems = profile._signalItems ?? EMPTY_SIGNALS;

      // ---- 领域打分与收录（纯本地计算，不耗额度）----
      const ctxs = scoreDomains(profile, prefs, { blind });
      const genOrder = ctxs
        .filter((c) => c.included)
        .sort((a, b) => Number(b.isMain) - Number(a.isMain) || b.score - a.score);
      const toGen = genOrder.slice(0, maxDomains);
      const overflow = genOrder.slice(maxDomains);

      const skipped = [];
      for (const c of ctxs) {
        if (!c.included) {
          skipped.push({ domain_id: c.def.id, name: c.def.name, reason: c.skipReason });
        }
      }
      for (const c of overflow) {
        skipped.push({
          domain_id: c.def.id, name: c.def.name,
          reason: `依据弱于前 ${maxDomains} 个领域，今日未生成`,
        });
      }

      // ---- 领域串行生成（配额纪律：不并发；任务五起全部走搜索召回，creator=0）----
      const tDomains = performance.now();
      const reports = [];
      for (const ctx of toGen) {
        const r = await buildDomainReport(ctx, {
          profile, signalItems, oauthToken, useAI, warnings,
        });
        if (r) reports.push(r);
        else skipped.push({
          domain_id: ctx.def.id, name: ctx.def.name,
          reason: ctx.skipNote ?? '今日未召回到相关内容，未生成',
        });
      }
      steps.domains_ms = Math.round(performance.now() - tDomains);

      // ---- 推荐页聚合（数字 = 各领域 breakdown 之和，后端计算）----
      const tMainline = performance.now();
      const mainCtx = ctxs.find((c) => c.isMain);
      const mainReport = (mainCtx && reports.find((r) => r.domain_id === mainCtx.def.id))
        ?? reports[0] ?? null;
      const sums = reports.reduce((acc, r) => ({
        search: acc.search + r.basis.breakdown.search,
        personal: acc.personal + r.basis.breakdown.personal,
        qa: acc.qa + r.basis.breakdown.question_answers,
        total: acc.total + r.basis.synthesized_count,
      }), { search: 0, personal: 0, qa: 0, total: 0 });

      const modes = new Set(reports.map((r) => r.generated_by));
      const curation = reports.length === 0 ? 'none'
        : modes.size > 1 ? 'mixed'
          : [...modes][0];

      const { _tagQuestions, _signalItems, warnings: _pw, ...publicProfile } = profile;

      const result = {
        schema_version: '4.0',
        daily_id: `d_${today().replace(/-/g, '')}_${userRef}`,
        date: today(),
        generated_at: Math.floor(Date.now() / 1000),
        user_ref: userRef,
        data_source: {
          platform: 'zhihu',
          auth_mode: oauthToken ? 'oauth_user' : 'access_secret_owner',
          curation,
        },
        // 任务四：补盲模式回显（signal_only=只看我的方向 / with_blind=含关联拓展补盲）
        fill_mode: blind ? 'with_blind' : 'signal_only',
        profile: publicProfile,

        // ---- 推荐页：今日主线 ----
        mainline: {
          judgement: mainReport?.judgement ?? '',
          first_read: mainReport ? {
            domain_id: mainReport.domain_id,
            name: mainReport.name,
            reason: mainCtx && mainCtx.score >= 2
              ? `依据最强（信号分 ${mainCtx.score}），置信度最高`
              : '今日无强信号领域，此为补盲首推',
          } : null,
          basis_text: `今日从个人内容 ${sums.personal} 篇、知乎搜索 ${sums.search} 篇、问题回答 ${sums.qa} 篇中，综合 ${sums.total} 篇生成。热榜仅用于发现议题。`,
          total_synthesized: sums.total,
        },

        domains: reports,
        skipped_domains: skipped,
        stale: false,
        warnings,
      };
      steps.mainline_ms = Math.round(performance.now() - tMainline);
      return result;
    }));

    // force 时把新结果同步到稳定 key，保证后续读取一致
    if (force) cacheSet(cacheKey, value, config.cacheTtl.daily);
    return { daily: value, cached: force ? false : cached, metrics: metricsOf(value) };
  } catch (err) {
    // 配额耗尽时返回上一期缓存 + stale 标记（方案 10.4：不伪造内容）。
    // 精确 key 找不到时回退到该用户同一 blind 档的任意一期日报（任务四：档内隔离）：
    // 偏好/反馈/标签变化会改变 cacheKey，但「上一期真实生成过的日报」仍是合法降级结果。
    const old = cacheGetStale(cacheKey) ?? cacheGetStaleByPrefix(`daily:v4:${userRef}:${blindSeg}:`);
    if (old && err instanceof ZhihuApiError && err.isQuota) {
      return {
        daily: { ...old, stale: true, stale_reason: '知乎接口额度已用尽，当前展示最近一次成功生成的日报。' },
        cached: true,
        metrics: metricsOf(old),
      };
    }
    throw err;
  }
}

/**
 * 主动策展（方案 8.3）：用户输入一个主题，复用领域引擎生成临时领域日报。
 * 临时领域为 standard 档、走搜索召回（任务五起不再用 recommend），返回单个领域日报结构。
 */
export async function buildTopicDossier(topic, { oauthToken = null, useAI = true } = {}) {
  const warnings = [];
  const ctx = makeCustomDomainCtx(topic);
  const report = await buildDomainReport(ctx, {
    signalItems: EMPTY_SIGNALS, oauthToken, useAI, warnings,
  });
  if (!report) {
    throw new ZhihuApiError(`未能就「${topic}」检索到可用内容，请换一个更具体的主题。`);
  }
  return {
    schema_version: '4.0',
    type: 'topic_dossier',
    topic,
    generated_at: Math.floor(Date.now() / 1000),
    ...report,
    warnings,
  };
}

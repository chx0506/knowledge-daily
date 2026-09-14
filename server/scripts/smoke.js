// 冒烟测试：启动服务后运行 `node scripts/smoke.js`
// 覆盖端点可用性、领域日报 4.0 结构、推荐可回溯性、偏好与反馈闭环、
// 缓存、并发去重、OAuth state 安全、凭证不泄露、降级路径。
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';

let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { pass += 1; results.push(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail += 1; results.push(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`); }
}

const req = async (p, { method = 'GET', body } = {}) => {
  const res = await fetch(BASE + p, {
    method, redirect: 'manual',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 302 无 body */ }
  return { status: res.status, json, text };
};

const SOURCE_TYPES = ['关注', '收藏', '创作', '搜索'];
const nonNegInt = (n) => Number.isInteger(n) && n >= 0;

async function main() {
  console.log(`\n知识日报 · 冒烟测试（schema 4.0 领域日报）→ ${BASE}\n${'─'.repeat(62)}`);

  // 仿真端地址（7d 场景切换与任务五 creator 消耗统计共用）；非仿真环境相关断言自动跳过
  const SIM = process.env.SMOKE_SIM || 'http://127.0.0.1:3999';
  const simOk = await fetch(`${SIM}/_sim/scene`).then((r) => r.ok).catch(() => false);
  // 统计归零：任务五断言「全程 creator 消耗为 0」需要一个干净起点
  if (simOk) await fetch(`${SIM}/_sim/reset`).catch(() => {});

  // 1. 健康检查
  const health = await req('/api/health');
  check('健康检查可用', health.status === 200 && health.json?.ok === true);
  check('schema 版本为 4.0', health.json?.schema_version === '4.0');
  const hasOAuth = health.json?.capabilities?.oauth_login === true;
  console.log(`  内容接口: ${health.json?.capabilities?.content_api ? '已配置' : '未配置'} | OAuth: ${hasOAuth ? '已配置' : '未配置(待领取凭证)'}\n`);

  // 2. 额度
  const quota = await req('/api/quota');
  check('额度接口可用', quota.status === 200 && Array.isArray(quota.json?.items));
  const necks = (quota.json?.items ?? []).filter((i) => i.bottleneck).map((i) => i.api_id);
  check('已标记瓶颈额度池', necks.length > 0, necks.join(', '));

  // 3. 学习方向（方案 8.1）
  const savePrefs = await req('/api/profile/preferences', {
    method: 'POST',
    body: { directions: ['AI Agent'], goal: '理解 Agent 工程落地' },
  });
  check('可保存学习方向', savePrefs.json?.ok === true);
  const readPrefs = await req('/api/profile/preferences');
  check('可读回学习方向', readPrefs.json?.preferences?.directions?.includes('AI Agent'));

  // 4. 画像
  const prof = await req('/api/profile');
  check('画像接口可用', prof.status === 200 && Array.isArray(prof.json?.tags));
  check('主动选择的方向被采纳为高置信度',
    prof.json?.tags?.some((t) => t.confidence_tier === 'high' && t.source === 'user_direction'));
  check('每个标签带置信度分层',
    (prof.json?.tags ?? []).every((t) => ['high', 'medium', 'low'].includes(t.confidence_tier)));
  check('每个标签均有证据可回溯',
    (prof.json?.tags ?? []).every((t) => Array.isArray(t.evidence) && t.evidence.length > 0));
  check('平台原始推荐与加工标签分离', Boolean(prof.json?.platform_recommendation?.source));
  check('画像输出已剥离内部信号字段',
    !('_signalItems' in (prof.json ?? {})) && !('_tagQuestions' in (prof.json ?? {})));

  // 5. 领域日报（schema 4.0）
  const daily = await req('/api/daily?domains=1');
  check('日报接口可用', daily.status === 200);
  check('冷启动日报 creator 消耗为 0（任务五：默认路径不再触碰 creator 池）',
    (daily.json?.metrics?.api_calls?.by_endpoint?.creator ?? 0) === 0,
    JSON.stringify(daily.json?.metrics?.api_calls?.by_endpoint ?? {}));
  const d = daily.json ?? {};
  check('日报 schema 版本为 4.0', d.schema_version === '4.0');
  check('日报内画像已剥离内部信号字段',
    !('_signalItems' in (d.profile ?? {})) && !('_tagQuestions' in (d.profile ?? {})));

  // 5a. mainline 聚合
  check('mainline 存在且 total_synthesized 为数字',
    Boolean(d.mainline) && typeof d.mainline?.total_synthesized === 'number');
  const sumSynth = (d.domains ?? []).reduce((a, x) => a + (x.basis?.synthesized_count ?? 0), 0);
  check('total_synthesized 等于各领域综合数之和',
    d.mainline?.total_synthesized === sumSynth, `total=${d.mainline?.total_synthesized}, Σdomains=${sumSynth}`);
  check('mainline.basis_text 含真实综合篇数',
    Boolean(d.mainline?.basis_text?.includes(`综合 ${d.mainline?.total_synthesized} 篇`)));
  const frDomain = (d.domains ?? []).find((x) => x.domain_id === d.mainline?.first_read?.domain_id);
  check('mainline.first_read 指向已生成领域', Boolean(frDomain));
  check('主线判断取自主领域判断',
    Boolean(frDomain) && d.mainline?.judgement === frDomain?.judgement);

  // 5b. 领域结构
  check('至少生成 1 个领域', (d.domains ?? []).length >= 1, `${(d.domains ?? []).length} 个`);
  check('生成领域数不超过 domains 参数', (d.domains ?? []).length <= 1);
  check('每个领域 tier 合法',
    (d.domains ?? []).every((x) => ['deep', 'standard', 'blind'].includes(x.tier)));
  check('每个领域 basis.text 非空且 signals 为非负整数',
    (d.domains ?? []).every((x) => Boolean(x.basis?.text)
      && Object.values(x.basis?.signals ?? {}).every(nonNegInt)));
  check('basis.synthesized_count 等于 breakdown 之和',
    (d.domains ?? []).every((x) => {
      const b = x.basis?.breakdown ?? {};
      return x.basis?.synthesized_count === (b.search ?? 0) + (b.personal ?? 0) + (b.question_answers ?? 0);
    }));
  check('每个领域 judgement 非空且不超过 60 字',
    (d.domains ?? []).every((x) => Boolean(x.judgement) && x.judgement.length <= 60));
  check('每个领域 report 在 200–800 字',
    (d.domains ?? []).every((x) => typeof x.report === 'string' && x.report.length >= 200 && x.report.length <= 800),
    (d.domains ?? []).map((x) => `${x.domain_id}:${x.report?.length ?? 0}字`).join(', '));
  check('每个领域推荐 2–3 篇',
    (d.domains ?? []).every((x) => (x.recommended ?? []).length >= 2 && (x.recommended ?? []).length <= 3));
  check('每篇推荐都有真实 URL',
    (d.domains ?? []).every((x) => (x.recommended ?? []).every((r) => r.url?.startsWith('http'))));
  check('每篇推荐 source_type 合法',
    (d.domains ?? []).every((x) => (x.recommended ?? []).every((r) => SOURCE_TYPES.includes(r.source_type))));
  check('每篇推荐 why_now 非空',
    (d.domains ?? []).every((x) => (x.recommended ?? []).every((r) => Boolean(r.why_now))));
  check('推荐的 source_id 都能在 source_index 中找到',
    (d.domains ?? []).every((x) => {
      const idx = new Set((x.source_index ?? []).map((s) => s.source_id));
      return (x.recommended ?? []).every((r) => idx.has(r.source_id));
    }));
  check('source_index 每条都有真实 URL',
    (d.domains ?? []).every((x) => (x.source_index ?? []).length > 0
      && (x.source_index ?? []).every((s) => s.url?.startsWith('http'))));
  check('cited 标记与推荐集合一致',
    (d.domains ?? []).every((x) => {
      const recIds = new Set((x.recommended ?? []).map((r) => r.source_id));
      return (x.source_index ?? []).every((s) => s.cited === recIds.has(s.source_id));
    }));
  check('skipped_domains 每项都有原因',
    (d.skipped_domains ?? []).every((s) => Boolean(s.reason)));
  check('生成 + 跳过覆盖全部可投递领域（受前端白名单约束）',
    (d.domains ?? []).length + (d.skipped_domains ?? []).length
      === (health.json?.web_domain_catalog?.length ?? 6),
    `gen=${(d.domains ?? []).length}, skip=${(d.skipped_domains ?? []).length}, web_catalog=${health.json?.web_domain_catalog?.length}`);
  // 契约护栏：前端 mapId() 对未知 id 兜底为 "tech"，两个领域同 id 会让
  // orderedBlocks 的 find() 吃掉一个（整篇报告从报纸上消失）——故下发 id 必须全部在白名单内。
  const WEB_IDS = health.json?.web_domain_catalog ?? [];
  const offenders = [...(d.domains ?? []), ...(d.skipped_domains ?? [])]
    .map((x) => x.domain_id).filter((id) => !WEB_IDS.includes(id));
  check('契约：下发的领域 id 全部在前端白名单内（不会被兜底成 tech）',
    offenders.length === 0,
    offenders.length ? `越界: ${[...new Set(offenders)].join(', ')}` : `全部 ∈ {${WEB_IDS.join(',')}}`);
  check('日报生成无 warning', (d.warnings ?? []).length === 0, (d.warnings ?? []).join('; ') || '无');

  // 6. 缓存
  const t0 = Date.now();
  const again = await req('/api/daily?domains=1');
  check('二次请求命中缓存', again.json?.cached === true, `${Date.now() - t0}ms`);
  check('缓存命中时 daily_id 稳定', again.json?.daily_id === d.daily_id);

  // 7. 降级路径（方案 11：必须提供降级状态）
  const ruled = await req('/api/daily?ai=false&domains=1');
  check('ai=false 时 curation 标记为 rule_fallback',
    ruled.json?.data_source?.curation === 'rule_fallback');
  check('ai=false 时所有领域 generated_by 为 rule_fallback',
    (ruled.json?.domains ?? []).length > 0
    && (ruled.json?.domains ?? []).every((x) => x.generated_by === 'rule_fallback'));
  check('降级版结构与 AI 版一致（report 200–800 字、推荐 ≥2 篇、链接真实）',
    (ruled.json?.domains ?? []).every((x) => typeof x.report === 'string'
      && x.report.length >= 200 && x.report.length <= 800
      && (x.recommended ?? []).length >= 2
      && (x.recommended ?? []).every((r) => r.url?.startsWith('http') && r.why_now)));

  // 7b. 动态领域（D1）与可观测性（B2）、作者主页（C1）
  // D1 的「能力」仍在（目录含 10 领域、工作流齐全），但「投递」受前端白名单约束：
  // 未适配的前端把 gaming/design/science/travel 兜底成 tech，会吃掉整篇领域报告。
  // 白名单外的领域因此不投递，放开方式见下方 ZHIHU_WEB_DOMAINS=all 留门用例。
  const wide = await req('/api/daily?domains=10');
  const wDoms = wide.json?.domains ?? [];
  const wIds = new Set(wDoms.map((x) => x.domain_id));
  check('动态领域（D1）：目录仍含 10 个领域（能力未被削弱）',
    ['gaming', 'design', 'science', 'travel']
      .every((id) => (health.json?.domain_catalog ?? []).includes(id)),
    `catalog=${(health.json?.domain_catalog ?? []).length}: ${(health.json?.domain_catalog ?? []).join(',')}`);
  check('动态领域（D1）：白名单生效，投递不超出可投递领域数',
    wDoms.length <= (health.json?.web_domain_catalog ?? []).length
      && [...wIds].every((id) => (health.json?.web_domain_catalog ?? []).includes(id)),
    `${wDoms.length} 篇: ${[...wIds].join(', ')}`);
  const m = wide.json?.metrics;
  check('日报含 metrics 且 total_ms > 0',
    Boolean(m) && typeof m.total_ms === 'number' && m.total_ms > 0,
    m ? `total=${m.total_ms}ms, api=${m.api_calls?.total}` : '缺 metrics');
  check('metrics 含分步耗时与 API 调用计数',
    Boolean(m?.steps)
    && typeof m.steps.profile_ms === 'number'
    && typeof m.steps.domains_ms === 'number'
    && typeof m.steps.mainline_ms === 'number'
    && (m?.api_calls?.total ?? 0) >= 1
    && typeof m?.api_calls?.by_endpoint === 'object',
    m ? `profile=${m.steps?.profile_ms}ms, domains=${m.steps?.domains_ms}ms, mainline=${m.steps?.mainline_ms}ms` : '');
  check('推荐条目均含 author_url 字段（可为 null 但 key 必须在）',
    wDoms.length > 0
    && wDoms.every((x) => (x.recommended ?? []).every((r) => 'author_url' in r)));
  check('仿真数据至少给出一个非空 author_url',
    wDoms.some((x) => (x.recommended ?? []).some(
      (r) => typeof r.author_url === 'string' && r.author_url.includes('/people/'))),
    wDoms.flatMap((x) => x.recommended ?? []).find((r) => r.author_url)?.author_url ?? '无非空值');

  // 7c. 切词碎片修复回归（任务三，复刻真实案例「平心而论红楼梦是不是被严重高估了？」）
  const tagNames = (prof.json?.tags ?? []).map((t) => t.name);
  check('画像 top 标签含「红楼梦」',
    tagNames.some((n) => n.includes('红楼梦')), tagNames.join(', '));
  check('top 标签不含切词碎片（心而论红 / 而论红楼 / 含「而论」）',
    !tagNames.some((n) => ['心而论红', '而论红楼'].includes(n) || n.includes('而论')));
  check('画像 top 标签不含搜索核验淘汰的碎片（被严重高 / 严重高估）',
    !tagNames.some((n) => ['被严重高', '严重高估'].includes(n)), tagNames.join(', '));
  const daily8 = await req('/api/daily?domains=8');
  const ids8 = new Set((daily8.json?.domains ?? []).map((x) => x.domain_id));
  check('文化领域在 domains=8 时被打中生成（不再进 skipped）',
    ids8.has('culture'),
    `gen=${[...ids8].join(', ')} | skipped=${(daily8.json?.skipped_domains ?? []).map((s) => s.domain_id).join(', ')}`);

  // 7d. 补盲开关与关联拓展补盲（任务四；仿真稀疏画像：仅文化类信号）
  // 依赖仿真端 /_sim/scene 切换场景；打非仿真环境时跳过本组。
  // SIM/simOk 复用 main() 顶部的声明（任务五统计共用）
  const sceneSet = async (scene) => {
    try {
      const r = await fetch(`${SIM}/_sim/scene`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene }),
      });
      return r.ok;
    } catch { return false; }
  };
  if (simOk) {
    // 稀疏画像下「AI Agent」学习方向会命中 tech 关键词，先清空方向，
    // 保证画像只剩文化信号（场景结束恢复原方向）
    await req('/api/profile/preferences', { method: 'POST', body: { directions: [] } });
    await sceneSet('sparse');

    // a) blind=0：只生成有信号的领域，无信号领域（含原 allowBlind）全部进 skipped
    const b0 = await req('/api/daily?domains=8&blind=0');
    const b0Doms = b0.json?.domains ?? [];
    const b0Skip = b0.json?.skipped_domains ?? [];
    check('blind=0 时 fill_mode 为 signal_only', b0.json?.fill_mode === 'signal_only');
    check('blind=0 稀疏画像下只生成文化领域',
      b0Doms.length === 1 && b0Doms[0]?.domain_id === 'culture',
      `gen=${b0Doms.map((x) => x.domain_id).join(', ') || '无'}`);
    check('blind=0 时科技/财经进 skipped 且原因正确',
      ['tech', 'finance'].every((id) => b0Skip.some((s) => s.domain_id === id
        && s.reason === '无信号依据，今日未生成')),
      b0Skip.filter((s) => ['tech', 'finance'].includes(s.domain_id))
        .map((s) => `${s.domain_id}:${s.reason}`).join(' | ') || '未进 skipped');

    // b) 默认（blind=1）：科技/财经走关联拓展补盲
    const b1 = await req('/api/daily?domains=8');
    const b1Doms = b1.json?.domains ?? [];
    const techDom = b1Doms.find((x) => x.domain_id === 'tech');
    const finDom = b1Doms.find((x) => x.domain_id === 'finance');
    check('blind=1 时 fill_mode 为 with_blind', b1.json?.fill_mode === 'with_blind');
    check('科技补盲为 profile_anchored 且 basis 含锚标签与关联拓展',
      techDom?.tier === 'blind' && techDom?.blind_mode === 'profile_anchored'
      && techDom?.basis?.text?.includes('红楼梦') && techDom?.basis?.text?.includes('关联拓展'),
      techDom ? `${techDom.tier}/${techDom.blind_mode}` : 'tech 未生成');
    check('财经补盲为 profile_anchored 且 basis 含锚标签与关联拓展',
      finDom?.tier === 'blind' && finDom?.blind_mode === 'profile_anchored'
      && finDom?.basis?.text?.includes('红楼梦') && finDom?.basis?.text?.includes('关联拓展'),
      finDom ? `${finDom.tier}/${finDom.blind_mode}` : 'finance 未生成');

    // c) 缓存隔离：blind=1 不命中 blind=0 的缓存；blind=0 二次请求命中自身缓存
    check('blind=1 首次请求未命中 blind=0 缓存（缓存键含 blind 段）',
      b1.json?.cached === false);
    const b0again = await req('/api/daily?domains=8&blind=0');
    check('blind=0 二次请求命中自身缓存且 fill_mode 不变',
      b0again.json?.cached === true && b0again.json?.fill_mode === 'signal_only');

    // d) regenerate 的 body 支持 blind:0
    const regen = await req('/api/daily/regenerate', { method: 'POST', body: { domains: 8, blind: 0 } });
    check('regenerate body blind:0 生效（signal_only 且只生成文化）',
      regen.json?.fill_mode === 'signal_only'
      && (regen.json?.domains ?? []).length === 1
      && regen.json?.domains?.[0]?.domain_id === 'culture');

    // 恢复现场：全量画像 + 原学习方向
    await sceneSet('full');
    await req('/api/profile/preferences', {
      method: 'POST', body: { directions: ['AI Agent'], goal: '理解 Agent 工程落地' },
    });
  } else {
    console.log('  （仿真场景端点不可用，跳过 7d 补盲开关断言）');
  }

  // 8. 反馈闭环（topic 可传领域名或主题名）
  const firstDom = d.domains?.[0];
  const fb = await req('/api/feedback', {
    method: 'POST',
    body: {
      card_id: firstDom?.recommended?.[0]?.source_id ?? 'src_test',
      topic: firstDom?.name ?? '科技',
      feedback: 'want_more',
    },
  });
  check('可记录日报反馈', fb.json?.ok === true);
  const badFb = await req('/api/feedback', { method: 'POST', body: { card_id: 'x', feedback: 'bogus' } });
  check('拒绝非法反馈类型', badFb.status === 400 && badFb.json?.error === 'invalid_feedback');

  // 9. 主动策展（复用领域引擎的临时领域）
  const dossier = await req(`/api/topic/${encodeURIComponent('RAG 检索增强')}?ai=false`);
  check('主动策展专题可用且为 4.0 结构',
    dossier.status === 200 && dossier.json?.type === 'topic_dossier'
    && dossier.json?.schema_version === '4.0');
  check('专题含领域调研与推荐',
    typeof dossier.json?.report === 'string' && dossier.json.report.length >= 200
    && (dossier.json?.recommended ?? []).length >= 2);
  check('专题推荐链接真实且可回溯',
    (dossier.json?.recommended ?? []).every((r) => r.url?.startsWith('http'))
    && (dossier.json?.recommended ?? []).every((r) =>
      (dossier.json?.source_index ?? []).some((s) => s.source_id === r.source_id)));

  // 10. 并发去重（配额保护）
  const usedOf = async () => {
    const q = await req('/api/quota');
    return q.json.items.find((i) => i.api_id === 'zhihu_search')?.used ?? 0;
  };
  const before = await usedOf();
  const t = encodeURIComponent('并发去重验证主题');
  await Promise.all(Array.from({ length: 5 }, () => req(`/api/topic/${t}?ai=false`)));
  const after = await usedOf();
  check('5 次并发只消耗 1 次搜索额度', after - before <= 1, `增量 ${after - before}`);

  // 11. OAuth state 安全
  const noState = await req('/api/auth/callback?authorization_code=fake');
  check('拒绝缺失 state 的回调', noState.status === 400 && noState.json?.reason === 'state_missing');
  const forged = await req('/api/auth/callback?authorization_code=fake&state=forged');
  check('拒绝伪造 state 的回调', forged.status === 400 && forged.json?.reason === 'state_unknown');
  if (hasOAuth) {
    const l1 = await req('/api/auth/login?format=json');
    const l2 = await req('/api/auth/login?format=json');
    const u = l1.json?.authorize_url ?? '';
    check('授权 URL 含 app_id 与 state',
      u.includes('app_id=') && u.includes('state=') && u.includes('response_type=code'));
    check('每次授权生成不同 state',
      new URL(u).searchParams.get('state') !== new URL(l2.json.authorize_url).searchParams.get('state'));
  } else {
    const login = await req('/api/auth/login');
    check('未配置凭证时给出明确提示', login.json?.error === 'oauth_not_configured');
  }

  // 12. 未登录态与凭证保护
  const me = await req('/api/auth/me');
  check('未登录时不返回用户数据', me.json?.logged_in === false);
  const SENSITIVE = /"(access_token|oauth_token|app_key|accessSecret|ZHIHU_ACCESS_SECRET)"/i;
  const leaked = [];
  for (const ep of ['/api/daily?domains=1', '/api/profile', '/api/health', '/api/quota', '/api/auth/me']) {
    if (SENSITIVE.test((await req(ep)).text)) leaked.push(ep);
  }
  check('所有响应均不含凭证字段', leaked.length === 0, leaked.join(', ') || '已确认');

  // 13. 错误处理
  const nf = await req('/api/unknown');
  check('未知端点返回 404 与端点清单', nf.status === 404 && Array.isArray(nf.json?.endpoints));

  // 14. 任务五：全程 creator 池零消耗（仿真统计实证）
  // 必须在 15 之前断言——15 会主动打开 probe 消耗 creator。
  if (simOk) {
    const st = await fetch(`${SIM}/_sim/stats`).then((r) => r.json()).catch(() => null);
    check('全程无 creator 端点调用（/_sim/stats 实证）',
      (st?.by_api?.creator ?? 0) === 0, `creator=${st?.by_api?.creator ?? 0}`);
  }

  // 15. 任务五：PROFILE_PLATFORM_PROBE=1 留门验证（第二业务实例，测完即关）
  if (simOk) {
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const serverEntry = fileURLToPath(new URL('../server.js', import.meta.url));
    const child = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env, PORT: '3199', PROFILE_PLATFORM_PROBE: '1',
        ZHIHU_ACCESS_SECRET: process.env.ZHIHU_ACCESS_SECRET || 'sim-dummy',
        ZHIHU_API_BASE: SIM,
      },
      stdio: 'ignore',
    });
    try {
      let up = false;
      for (let i = 0; i < 40 && !up; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        up = await fetch('http://127.0.0.1:3199/api/health').then((r) => r.ok).catch(() => false);
      }
      const p2 = await fetch('http://127.0.0.1:3199/api/profile').then((r) => r.json()).catch(() => null);
      check('PROFILE_PLATFORM_PROBE=1 时平台画像探测返回内容（留门可用）',
        (p2?.platform_recommendation?.items ?? []).length > 0,
        `${(p2?.platform_recommendation?.items ?? []).length} 条`);
      const st2 = await fetch(`${SIM}/_sim/stats`).then((r) => r.json()).catch(() => null);
      check('探测开启后 creator 池确实被消耗（开关语义打通）',
        (st2?.by_api?.creator ?? 0) >= 1, `creator=${st2?.by_api?.creator ?? 0}`);
    } finally {
      child.kill();
      await fetch(`${SIM}/_sim/reset`).catch(() => {});
    }
  }

  // 16. ZHIHU_WEB_DOMAINS=all 留门验证（第二业务实例，测完即关）
  // 前端补齐 RemoteDomainId / REMOTE_TO_FRONT_DOMAIN 后，用这一个环境变量即可
  // 放开全部 10 个领域，无需改代码——证明白名单是"闸门"而非"阉割"。
  if (simOk) {
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const serverEntry = fileURLToPath(new URL('../server.js', import.meta.url));
    const child = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env, PORT: '3198', ZHIHU_WEB_DOMAINS: 'all',
        ZHIHU_ACCESS_SECRET: process.env.ZHIHU_ACCESS_SECRET || 'sim-dummy',
        ZHIHU_API_BASE: SIM,
      },
      stdio: 'ignore',
    });
    try {
      let up = false;
      for (let i = 0; i < 40 && !up; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        up = await fetch('http://127.0.0.1:3198/api/health').then((r) => r.ok).catch(() => false);
      }
      const h2 = await fetch('http://127.0.0.1:3198/api/health').then((r) => r.json()).catch(() => null);
      check('ZHIHU_WEB_DOMAINS=all 时 health 报告完整 10 领域（留门可用）',
        (h2?.web_domain_catalog ?? []).length === 10,
        `web_catalog=${(h2?.web_domain_catalog ?? []).length}`);
      const d2 = await fetch('http://127.0.0.1:3198/api/daily?domains=10')
        .then((r) => r.json()).catch(() => null);
      const ids2 = new Set((d2?.domains ?? []).map((x) => x.domain_id));
      check('放开后新领域确实可投递（游戏/设计/科学/旅行）',
        ['gaming', 'design', 'science', 'travel'].every((id) => ids2.has(id)),
        [...ids2].join(', '));
    } finally {
      child.kill();
      await fetch(`${SIM}/_sim/reset`).catch(() => {});
    }
  }

  console.log(results.join('\n'));
  console.log('─'.repeat(62));
  console.log(`  通过 ${pass} / 失败 ${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n冒烟测试异常终止:', err.message);
  console.error('请确认服务已启动：npm start\n');
  process.exit(1);
});

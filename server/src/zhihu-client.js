// 知乎开放平台 HTTP 客户端
// 双身份：Access Secret（调用方）+ 可选 X-OAuth-Token（被代表的授权用户）
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config.js';

// ---------------- B2：API 调用计数（统一出口埋点）----------------
//
// 每次真实外呼在此计数。AsyncLocalStorage 让一次日报流水线内的调用
// 归属到该次请求（并发请求互不污染）；无上下文时落入进程级兜底统计。
export const apiCallContext = new AsyncLocalStorage();

export const newApiCallCounter = () => ({ total: 0, byEndpoint: {} });

const processStats = { total: 0, byEndpoint: {} };

export function trackApiCall(apiId) {
  const key = apiId || 'unknown';
  const store = apiCallContext.getStore();
  if (store) {
    store.total += 1;
    store.byEndpoint[key] = (store.byEndpoint[key] ?? 0) + 1;
  }
  processStats.total += 1;
  processStats.byEndpoint[key] = (processStats.byEndpoint[key] ?? 0) + 1;
}

/** 进程级累计（健康检查观测用，不做请求级归因） */
export function apiCallStats() {
  return { total: processStats.total, by_endpoint: { ...processStats.byEndpoint } };
}

export class ZhihuApiError extends Error {
  constructor(message, { code, httpStatus, apiId } = {}) {
    super(message);
    this.name = 'ZhihuApiError';
    this.code = code;          // 业务 Code：10001/20001/30001/30002/90001
    this.httpStatus = httpStatus;
    this.apiId = apiId;
  }
  /** 配额或频率受限 —— 调用方应走缓存降级而不是重试 */
  get isQuota() { return this.code === 30001 || this.code === 30002; }
  /** 鉴权失败 —— 必须停止并要求重新授权，禁止静默回退到本人账号 */
  get isAuth() { return this.code === 20001 || this.httpStatus === 401; }
}

/**
 * uid 是 int64，可能超出 JS 安全整数范围。
 * 在文本层把长数字改写成字符串，避免 JSON.parse 丢精度。
 */
function parseJsonSafe(text) {
  const patched = text.replace(
    /"(uid|UID)"\s*:\s*(-?\d{16,})/g,
    (_m, k, v) => `"${k}":"${v}"`
  );
  return JSON.parse(patched);
}

/**
 * 出站节流：保证两次上游请求之间至少间隔 REQUEST_GAP_MS。
 *
 * 起因（真实数据实测）：冷启动一次日报会连续发出十几次搜索（画像标签核验 ≤4 次 +
 * 每领域 ≤2 次），实测触发开放平台的**频率**限制（不是日额度——当时搜索池只用了
 * 35/5000），报错 `rate limit exceeded`，直接导致该领域召回为空。
 * 领域本身已是串行处理，缺的只是请求之间的间隔。
 *
 * 代价：一次冷日报约十几次请求 × 120ms ≈ 1.5s，换来的是不再整条召回失败。
 */
const REQUEST_GAP_MS = Number(process.env.ZHIHU_REQUEST_GAP_MS ?? 120);
let lastRequestAt = 0;
let gate = Promise.resolve();

function throttle() {
  gate = gate.then(async () => {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return gate;
}

async function request(url, { headers = {}, method = 'GET', body, apiId } = {}) {
  trackApiCall(apiId);
  await throttle();
  let res;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (err) {
    throw new ZhihuApiError(`网络请求失败: ${err.message}`, { apiId });
  }

  const text = await res.text();
  let json;
  try {
    json = parseJsonSafe(text);
  } catch {
    throw new ZhihuApiError(`响应不是合法 JSON (HTTP ${res.status})`, {
      httpStatus: res.status, apiId,
    });
  }

  // 开放平台业务码：0 成功
  if (typeof json.Code === 'number' && json.Code !== 0) {
    throw new ZhihuApiError(json.Message || `业务错误 Code=${json.Code}`, {
      code: json.Code, httpStatus: res.status, apiId,
    });
  }
  if (!res.ok && json.Code === undefined) {
    throw new ZhihuApiError(`HTTP ${res.status}`, { httpStatus: res.status, apiId });
  }
  return json;
}

/** 开放平台内容/用户数据接口的统一请求头 */
function openApiHeaders(oauthToken) {
  if (!config.accessSecret) {
    throw new ZhihuApiError('未配置 ZHIHU_ACCESS_SECRET', { code: 20001 });
  }
  const headers = {
    Authorization: `Bearer ${config.accessSecret}`,
    'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    'Content-Type': 'application/json',
  };
  if (oauthToken) headers['X-OAuth-Token'] = oauthToken;
  return headers;
}

function buildUrl(pathname, params = {}) {
  const url = new URL(pathname, config.openApiBase);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const get = (pathname, params, oauthToken, apiId) =>
  request(buildUrl(pathname, params), { headers: openApiHeaders(oauthToken), apiId });

// ---------------- 公共内容能力 ----------------

/** 热榜。每日额度仅 100，必须全站共享缓存 */
export async function fetchHot(limit = 30) {
  const json = await get('/api/v1/content/hot_list',
    { Limit: Math.min(limit, 30) }, null, 'hot_list');
  return json.Data?.Items ?? [];
}

/** 知乎站内搜索，单次最多 10 条 */
export async function searchZhihu(query, count = 10) {
  const json = await get('/api/v1/content/zhihu_search',
    { Query: query, Count: Math.min(count, 10) }, null, 'zhihu_search');
  return json.Data?.Items ?? [];
}

/**
 * 问题下的回答摘要。翻页必须用返回的 NextOffset，不能按条数自算。
 * 注意：参数名是 QuestionUrl（实测确认），写成 QuestionURL 会返回 10001。
 */
export async function fetchQuestionAnswers(questionUrl, { limit = 20, offset } = {}) {
  const json = await get('/api/v1/content/question_answers',
    { QuestionUrl: questionUrl, Limit: Math.min(limit, 50), Offset: offset },
    null, 'question_answers');
  return {
    items: json.Data?.Items ?? [],
    paging: json.Data?.Paging ?? { IsEnd: true },
  };
}

// ---------------- 画像与用户数据 ----------------

/**
 * 推荐问题。
 * 不传 query -> 平台侧账号画像（样本稀疏时会返回泛人生向问题，不可单独使用）
 * 传 query   -> 主题校正推荐，相关性显著更好
 *
 * 注意：主题参数名必须是 Query。实测传 Topic/Keyword 时服务端返回 Code=0
 * 但会「静默忽略」该参数、退化为无 query 模式，结果看似成功实则不相关。
 */
export async function recommendQuestions({ query, count = 5, oauthToken } = {}) {
  const params = { Count: Math.min(count, 20) };
  if (query && query.trim()) params.Query = query.trim();
  const json = await get('/api/v1/user/question_recommendations',
    params, oauthToken, 'creator');
  return json.Data?.Items ?? [];
}

export async function fetchFollowees({ offset = 0, limit = 20, oauthToken } = {}) {
  const json = await get('/api/v1/user/followees',
    { Offset: offset, Limit: Math.min(limit, 50) }, oauthToken, 'user_data');
  return { items: json.Data?.Items ?? [], paging: json.Data?.Paging ?? { IsEnd: true } };
}

export async function fetchContents({ type = 'all', offset = 0, limit = 20, oauthToken } = {}) {
  const json = await get('/api/v1/user/contents',
    { ContentType: type, Offset: offset, Limit: Math.min(limit, 50), SortField: 'ts', SortOrder: 'desc' },
    oauthToken, 'user_data');
  return { items: json.Data?.Items ?? [], paging: json.Data?.Paging ?? { IsEnd: true } };
}

export async function fetchFavoriteLists({ limit = 20, oauthToken } = {}) {
  const json = await get('/api/v1/user/favlists',
    { Limit: Math.min(limit, 50) }, oauthToken, 'user_data');
  return json.Data?.Items ?? [];
}

export async function fetchRecentFavorites({ limit = 20, oauthToken } = {}) {
  const json = await get('/api/v1/user/collections',
    { Limit: Math.min(limit, 50) }, oauthToken, 'user_data');
  return json.Data?.Items ?? [];
}

/** 各能力池当日额度。查询本身不消耗业务额度 */
export async function fetchQuota() {
  const json = await get('/api/v1/quota', {}, null, 'quota');
  return json.Data ?? [];
}

// ---------------- 知乎直答（策展层使用）----------------

/**
 * 调用知乎直答生成结构化内容。
 * 模型档位：zhida-fast-1p5(快) / zhida-thinking-1p5(深度) / zhida-agent(智能检索)
 * 注意：直答会自行检索，但本项目只把它当「摘要与归纳器」，
 * 所有事实与来源仍以已召回的知乎原文为准，避免结论无法回溯。
 */
export async function zhidaComplete(prompt, {
  model = 'zhida-fast-1p5',
  system,
  timeoutMs = 45000,
} = {}) {
  if (!config.accessSecret) {
    throw new ZhihuApiError('未配置 ZHIHU_ACCESS_SECRET', { code: 20001 });
  }
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    trackApiCall('zhida_openai');
    res = await fetch(`${config.openApiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessSecret}`,
        'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ZhihuApiError(
      err.name === 'AbortError' ? '直答请求超时' : `直答请求失败: ${err.message}`,
      { apiId: 'zhida_openai' }
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new ZhihuApiError(`直答响应不是合法 JSON (HTTP ${res.status})`, { httpStatus: res.status, apiId: 'zhida_openai' }); }

  if (typeof json.Code === 'number' && json.Code !== 0) {
    throw new ZhihuApiError(json.Message || `直答业务错误 Code=${json.Code}`, {
      code: json.Code, httpStatus: res.status, apiId: 'zhida_openai',
    });
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new ZhihuApiError('直答未返回内容', { httpStatus: res.status, apiId: 'zhida_openai' });
  }
  return content;
}

/** 让直答按 JSON 返回；失败时抛出，由调用方降级到规则版 */
/**
 * 修复被截断的 JSON。
 *
 * 直答产出较长（judgement + 3 段正文 + 推荐数组），命中 token 上限时会在半句处
 * 断掉——这正是「直答返回的 JSON 无法解析」的主因，而且它偏偏发生在内容最长的
 * 那个领域上（实测：culture）。
 *
 * 做法：从尾部逐个「候选切点」（逗号、冒号）回退，每次尝试「补齐括号后解析」，
 * 成功即返回。切点数量受正文逗号数限制（几十个），代价可接受。
 * 修不好的仍返回 null 走上层降级——不假装成功。
 */
function closeBrackets(head) {
  let inString = false;
  let escaped = false;
  const stack = [];
  for (const ch of head) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inString) return null;          // 仍处在字符串里：这个切点不可用
  let out = head;
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  return out;
}

export function repairTruncatedJson(text) {
  // 候选切点：所有逗号与冒号，从尾部往前逐个尝试。
  // 不能只取「最后一个」——切在冒号上会留下「有键无值」（{"a":"x","report"}），
  // 必须继续回退到键前面的那个逗号才成立。
  const cuts = [text.length];
  for (let i = text.length - 1; i > 0; i -= 1) {
    const ch = text[i];
    if (ch === ',' || ch === ':') cuts.push(i);
  }
  for (const cut of cuts) {
    const head = text.slice(0, cut).replace(/[,\s]+$/, '');
    const closed = closeBrackets(head);
    if (!closed) continue;
    // 必须真的解析一次才算数：只构造字符串不验证，会在第一个候选点
    // （例如切在冒号上、留下「有键无值」）就直接返回非法结果。
    try { JSON.parse(closed); return closed; } catch { /* 这个切点不成立，继续往前 */ }
  }
  return null;
}

export async function zhidaJson(prompt, opts = {}) {
  const raw = await zhidaComplete(prompt, {
    system: '你是严谨的内容编辑。只输出合法 JSON，不要输出 Markdown 代码块标记或任何解释文字。',
    ...opts,
  });
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new ZhihuApiError('直答返回内容不含 JSON');
  const body = cleaned.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    // 容错①：截到最后一个闭合括号再试
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (end > 0) {
      try { return JSON.parse(body.slice(0, end + 1)); } catch { /* fallthrough */ }
    }
    // 容错②：被 token 上限截断时，逐切点回退补齐后再试
    const repaired = repairTruncatedJson(body);
    if (repaired) {
      try { return JSON.parse(repaired); } catch { /* fallthrough */ }
    }
    throw new ZhihuApiError('直答返回的 JSON 无法解析');
  }
}

// ---------------- OAuth ----------------

/** 用 authorization_code 换 access_token（注意：表单字段名是 code） */
export async function exchangeToken(code) {
  const form = new URLSearchParams({
    app_id: config.oauth.appId,
    app_key: config.oauth.appKey,
    grant_type: 'authorization_code',
    redirect_uri: config.oauth.redirectUri,
    code,
  });
  trackApiCall('oauth_token');
  const res = await fetch(config.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await res.text();
  let json;
  try { json = parseJsonSafe(text); }
  catch { throw new ZhihuApiError(`token 响应不是合法 JSON (HTTP ${res.status})`, { httpStatus: res.status }); }

  // code:20000 表示成功；以 access_token 是否存在为准
  if (!json.access_token) {
    throw new ZhihuApiError(json.message || json.data || 'token 交换失败：响应无 access_token',
      { httpStatus: res.status, code: json.code });
  }
  return {
    accessToken: json.access_token,
    tokenType: json.token_type || 'Bearer',
    expiresIn: Number(json.expires_in) || 3600,
  };
}

/** 授权用户基础信息。独立接口，只需 OAuth token，不需要 Access Secret */
export async function fetchOAuthUser(accessToken) {
  trackApiCall('oauth_user');
  const res = await fetch(config.oauth.userUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let json;
  try { json = parseJsonSafe(text); }
  catch { throw new ZhihuApiError(`用户信息响应不是合法 JSON (HTTP ${res.status})`, { httpStatus: res.status }); }

  // 历史错误形态：HTTP 200 + {"code":404,"data":"User don't exist"}
  if (!json.uid && !json.hash_id) {
    throw new ZhihuApiError(
      typeof json.data === 'string' ? json.data : '未获取到有效用户标识',
      { httpStatus: res.status, code: json.code }
    );
  }
  return {
    uid: String(json.uid),          // 始终以字符串传递
    hashId: json.hash_id || '',
    fullname: json.fullname || '',
    gender: json.gender || 'unknown',
    headline: json.headline || '',
    description: json.description || '',
    avatarPath: json.avatar_path || '',
    url: json.url || '',
  };
}

/** 构造授权跳转地址 */
export function buildAuthorizeUrl(state) {
  const url = new URL(config.oauth.authorizeUrl);
  url.searchParams.set('redirect_uri', config.oauth.redirectUri);
  url.searchParams.set('app_id', config.oauth.appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

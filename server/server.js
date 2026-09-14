// 知识日报 · 数据接口后端（零依赖）
//
// 端点：
//   GET  /api/health                  服务与配置自检
//   GET  /api/quota                   各能力池当日额度
//   GET  /api/auth/login              跳转知乎授权（带 state）
//   GET  /api/auth/callback           OAuth 回调，校验 state 后换 token
//   GET  /api/auth/me                 当前登录用户
//   POST /api/auth/logout             退出
//   GET  /api/profile                 兴趣画像
//   POST /api/profile/preferences     保存学习方向 / 关键词 / 屏蔽主题
//   GET  /api/daily                   今日领域日报（schema 4.0，?domains=1..6&blind=0 关补盲）
//   POST /api/daily/regenerate        重新生成日报（body 同支持 domains / blind）
//   POST /api/feedback                日报内反馈
//   GET  /api/topic/:topic            主动策展专题
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, checkConfig, mask } from './src/config.js';
import {
  ZhihuApiError, fetchQuota, exchangeToken, fetchOAuthUser, buildAuthorizeUrl,
} from './src/zhihu-client.js';
import {
  issueState, consumeState, createSession, getSession, destroySession,
  isTokenExpired, sessionStats, SESSION_COOKIE,
  buildSessionCookie, buildClearCookie, parseCookies,
} from './src/session.js';
import { buildProfile, makeUserRef, COLD_START_TAGS } from './src/profile.js';
import { buildDaily, buildTopicDossier } from './src/daily.js';
import { DOMAINS, webDomainCatalog } from './src/domains.js';
import {
  getPreferences, setPreferences, recordFeedback, getFeedbacks,
  FEEDBACK_TYPES, feedbackStats,
} from './src/preferences.js';
import { cacheStats } from './src/cache.js';

const isHttps = config.publicBaseUrl.startsWith('https://');

function send(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': config.publicBaseUrl,
    'Access-Control-Allow-Credentials': 'true',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function fail(res, err) {
  if (err instanceof ZhihuApiError) {
    if (err.isAuth) {
      return send(res, 401, {
        error: 'unauthorized',
        message: '知乎鉴权失败或授权已过期，请重新登录授权。',
        code: err.code,
      });
    }
    if (err.isQuota) {
      return send(res, 429, {
        error: 'quota_exceeded',
        message: '知乎接口额度或频率受限，请稍后再试。',
        code: err.code, api_id: err.apiId,
      });
    }
    return send(res, 502, { error: 'upstream_error', message: err.message, code: err.code });
  }
  console.error('[error]', err);
  return send(res, 500, { error: 'internal_error', message: err.message || '服务内部错误' });
}

async function readJsonBody(req, limitBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limitBytes) throw new Error('请求体过大');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('请求体不是合法 JSON'); }
}

/** 取当前会话；token 过期即销毁，绝不回退到 Access Secret 账号 */
function currentSession(req) {
  const sid = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  const session = getSession(sid);
  if (session && isTokenExpired(session)) {
    destroySession(sid);
    return { sid: null, session: null, expired: true };
  }
  return { sid, session, expired: false };
}

function ctxOf(req) {
  const { session } = currentSession(req);
  return session
    ? { oauthToken: session.oauthToken, userRef: makeUserRef(session.user.uid) }
    : { oauthToken: null, userRef: 'self' };
}

const parseTags = (url) => {
  const raw = url.searchParams.get('tags');
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6) : [];
};
const parseBool = (v, d) => (v === null || v === undefined ? d : !['0', 'false', 'no'].includes(v));
const parseInt2 = (v, d) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? n : d; };

// ---------------- 静态托管（部署用，本地开发零影响）----------------
//
// 部署必须**同源**：前端调的是相对路径 `/api/...`，而 CORS 只放行 publicBaseUrl，
// 且 OAuth 回调要落在同一 origin 才能带上会话 Cookie。
// 因此线上由本服务同时托管前端构建产物 dist/ 与 /api。
//
// 目录不存在时直接跳过（返回 false）→ 本地开发仍走 Vite dev + proxy，行为不变。
const STATIC_DIR = path.resolve(
  process.env.STATIC_DIR
    || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function serveStatic(req, res, url) {
  if (!existsSync(STATIC_DIR)) return false;
  const relPath = decodeURIComponent(url.pathname);
  if (relPath.includes('\0')) return false;
  let file = path.resolve(STATIC_DIR, `.${path.posix.normalize(relPath)}`);
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) return false; // 目录穿越防护
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (path.extname(relPath)) return false;            // 缺失的静态资源 → 交给 404
    file = path.join(STATIC_DIR, 'index.html');          // SPA 兜底
    if (!existsSync(file)) return false;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (req.method === 'HEAD') { res.end(); return true; }
  createReadStream(file).pipe(res);
  return true;
}

// ---------------- 路由 ----------------

async function route(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  // --- 健康检查 ---
  if (p === '/api/health') {
    const cfg = checkConfig();
    return send(res, 200, {
      ok: true,
      service: 'zhishi-ribao-api',
      product: '知识日报',
      schema_version: '4.0',
      config: {
        access_secret: cfg.canServeContent ? mask(config.accessSecret) : '(unset)',
        oauth_app_id: config.oauth.appId || '(unset)',
        oauth_app_key: config.oauth.appKey ? '(set)' : '(unset)',
        redirect_uri: config.oauth.redirectUri,
      },
      capabilities: {
        content_api: cfg.canServeContent,
        oauth_login: cfg.canServeOAuth,
        ai_curation: cfg.canServeContent,
      },
      domain_catalog: DOMAINS.map((d) => d.id),
      // 实际会投递给 Web 前端的领域（前端 RemoteDomainId 白名单内的子集）
      web_domain_catalog: webDomainCatalog().map((d) => d.id),
      missing_env: cfg.missing,
      runtime: { ...sessionStats(), ...feedbackStats(), cache: cacheStats() },
    });
  }

  // --- 额度 ---
  if (p === '/api/quota') {
    const data = await fetchQuota();
    return send(res, 200, {
      generated_at: Math.floor(Date.now() / 1000),
      items: data.map((q) => ({
        api_id: q.APIID, api_name: q.APIName,
        total: q.TotalQuota, used: q.TotalUsed, remaining: q.RemainingQuota,
        bottleneck: q.TotalQuota <= 100,
      })),
    });
  }

  // --- 发起授权 ---
  if (p === '/api/auth/login') {
    const cfg = checkConfig();
    if (!cfg.canServeOAuth) {
      return send(res, 503, {
        error: 'oauth_not_configured',
        message: '尚未配置 ZHIHU_OAUTH_APP_ID / ZHIHU_OAUTH_APP_KEY。请在赛事页面领取后填入 .env。',
        how_to_get: 'https://www.zhihu.com/hackathon?activity_code=zhihu_hackathon_2026_p2',
      });
    }
    const state = issueState();
    const target = buildAuthorizeUrl(state);
    if (url.searchParams.get('format') === 'json') return send(res, 200, { authorize_url: target });
    res.writeHead(302, { Location: target });
    return res.end();
  }

  // --- 授权回调 ---
  if (p === '/api/auth/callback') {
    const code = url.searchParams.get('authorization_code') || url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const check = consumeState(state);
    if (!check.ok) {
      return send(res, 400, {
        error: 'invalid_state', reason: check.reason,
        message: 'state 校验未通过，已拒绝本次登录。请重新发起授权。',
      });
    }
    if (!code) return send(res, 400, { error: 'missing_code', message: '回调缺少 authorization_code。' });

    const token = await exchangeToken(code);
    const user = await fetchOAuthUser(token.accessToken);
    const sid = createSession({ oauthToken: token.accessToken, expiresIn: token.expiresIn, user });
    const cookie = buildSessionCookie(sid, { secure: isHttps });

    if (url.searchParams.get('format') === 'json') {
      return send(res, 200, {
        ok: true,
        user: { user_ref: makeUserRef(user.uid), fullname: user.fullname, avatar: user.avatarPath },
      }, { 'Set-Cookie': cookie });
    }
    res.writeHead(302, { Location: config.loginSuccessRedirect, 'Set-Cookie': cookie });
    return res.end();
  }

  // --- 当前用户 ---
  if (p === '/api/auth/me') {
    const { session, expired } = currentSession(req);
    if (!session) {
      return send(res, 200, {
        logged_in: false,
        ...(expired ? { reason: 'token_expired' } : {}),
        login_url: '/api/auth/login',
      });
    }
    const u = session.user;
    return send(res, 200, {
      logged_in: true,
      user: {
        user_ref: makeUserRef(u.uid),
        fullname: u.fullname, headline: u.headline,
        description: u.description, avatar: u.avatarPath, gender: u.gender,
      },
      token_expires_at: Math.floor(session.tokenExpiresAt / 1000),
    });
  }

  // --- 退出 ---
  if (p === '/api/auth/logout' && method === 'POST') {
    destroySession(currentSession(req).sid);
    return send(res, 200, { ok: true }, { 'Set-Cookie': buildClearCookie({ secure: isHttps }) });
  }

  // --- 保存学习方向（方案 8.1 第 3 步）---
  if (p === '/api/profile/preferences') {
    const { userRef } = ctxOf(req);
    if (method === 'GET') {
      return send(res, 200, {
        user_ref: userRef,
        preferences: getPreferences(userRef),
        options: COLD_START_TAGS,
      });
    }
    if (method === 'POST') {
      const body = await readJsonBody(req);
      const saved = setPreferences(userRef, body);
      return send(res, 200, {
        ok: true, user_ref: userRef, preferences: saved,
        note: '学习方向属于高置信度信号，下次生成日报时将优先采用。',
      });
    }
    return send(res, 405, { error: 'method_not_allowed' });
  }

  // --- 兴趣画像 ---
  if (p === '/api/profile') {
    const { oauthToken, userRef } = ctxOf(req);
    const { profile, cached } = await buildProfile({
      oauthToken, userRef, manualTags: parseTags(url),
    });
    const { _tagQuestions, _signalItems, ...publicProfile } = profile;
    return send(res, 200, { ...publicProfile, cached, cold_start_options: COLD_START_TAGS });
  }

  // --- 日报（schema 4.0：领域日报）---
  if (p === '/api/daily' || (p === '/api/daily/regenerate' && method === 'POST')) {
    const force = p.endsWith('/regenerate');
    const { oauthToken, userRef } = ctxOf(req);
    const body = force ? await readJsonBody(req).catch(() => ({})) : {};
    // domains=1..N：最多生成几个领域，默认 3（替代旧 topics 参数；上限 = 可投递给前端的领域数）
    const maxDomains = Math.max(1, Math.min(webDomainCatalog().length,
      parseInt2(url.searchParams.get('domains'), body.domains ?? 3)));
    // 任务四 blind 开关：query 的 blind=0 或 body 的 blind:false/0/'0' 关闭补盲，
    // 缺省开启（保持现有行为）；关闭后无信号领域（含原 allowBlind）全部进 skipped
    const blind = parseBool(url.searchParams.get('blind'),
      ![false, 0, '0', 'false'].includes(body.blind));
    const { daily, cached, metrics } = await buildDaily({
      oauthToken, userRef,
      manualTags: parseTags(url),
      useAI: parseBool(url.searchParams.get('ai'), body.ai !== false),
      maxDomains,
      force,
      blind,
    });
    return send(res, 200, { ...daily, cached, metrics });
  }

  // --- 日报反馈（方案 8.2 第 4 步）---
  if (p === '/api/feedback' && method === 'POST') {
    const { userRef } = ctxOf(req);
    const body = await readJsonBody(req);
    if (!body.card_id || !body.feedback) {
      return send(res, 400, {
        error: 'invalid_body',
        message: '需要 card_id 与 feedback 字段。',
        allowed_feedback: FEEDBACK_TYPES,
      });
    }
    try {
      const rec = recordFeedback(userRef, {
        cardId: String(body.card_id), topic: body.topic, feedback: body.feedback,
      });
      return send(res, 200, {
        ok: true, recorded: rec,
        total_feedbacks: getFeedbacks(userRef).length,
        note: '反馈已计入兴趣画像，可调用 /api/daily/regenerate 重新生成日报。',
      });
    } catch (err) {
      return send(res, 400, { error: 'invalid_feedback', message: err.message, allowed_feedback: FEEDBACK_TYPES });
    }
  }

  // --- 主动策展专题（方案 8.3）---
  if (p.startsWith('/api/topic/')) {
    const topic = decodeURIComponent(p.slice('/api/topic/'.length)).trim();
    if (!topic) return send(res, 400, { error: 'missing_topic', message: '缺少专题主题。' });
    const { oauthToken } = ctxOf(req);
    return send(res, 200, await buildTopicDossier(topic, {
      oauthToken, useAI: parseBool(url.searchParams.get('ai'), true),
    }));
  }

  // --- 静态托管（仅非 /api 路径；目录不存在时自动跳过）---
  if ((method === 'GET' || method === 'HEAD') && !p.startsWith('/api/') && serveStatic(req, res, url)) return;

  return send(res, 404, {
    error: 'not_found',
    message: `未知端点 ${p}`,
    endpoints: [
      'GET /api/health', 'GET /api/quota',
      'GET /api/auth/login', 'GET /api/auth/callback',
      'GET /api/auth/me', 'POST /api/auth/logout',
      'GET /api/profile', 'GET|POST /api/profile/preferences',
      'GET /api/daily', 'POST /api/daily/regenerate',
      'POST /api/feedback', 'GET /api/topic/:topic',
    ],
  });
}

// ---------------- 启动 ----------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': config.publicBaseUrl,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  const url = new URL(req.url, config.publicBaseUrl);
  try { await route(req, res, url); }
  catch (err) { fail(res, err); }
});

server.listen(config.port, config.host, () => {
  const cfg = checkConfig();
  console.log('\n  知识日报 · 数据接口后端');
  console.log(`  监听 http://${config.host}:${config.port}`);
  console.log(`  Access Secret : ${cfg.canServeContent ? mask(config.accessSecret) : '未配置'}`);
  console.log(`  OAuth 凭证    : ${cfg.canServeOAuth ? '已配置' : '未配置（内容接口仍可用）'}`);
  console.log(`  回调地址      : ${config.oauth.redirectUri}`);
  if (cfg.missing.length) console.log(`  待补环境变量  : ${cfg.missing.join(', ')}`);
  console.log('');
});

export { server };

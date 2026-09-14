// 配置加载：零依赖读取 .env，环境变量优先
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉成对引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // 环境变量优先，不覆盖已存在的值
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const int = (v, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : d;
};

/**
 * 兼容从 macOS 钥匙串直接导出的值。
 * go-keyring 会以 `go-keyring-base64:<b64>` 形式存储，直接当 Bearer 用会 20001。
 */
function normalizeSecret(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  const PREFIX = 'go-keyring-base64:';
  if (v.startsWith(PREFIX)) {
    try {
      return Buffer.from(v.slice(PREFIX.length), 'base64').toString('utf8').trim();
    } catch {
      return v;
    }
  }
  return v;
}

/**
 * 仿真 / 代理模式（方案 A：API base 重定向）。
 * 设置 ZHIHU_API_BASE 后，开放平台与 OAuth 三个 URL 的 origin 全部替换为它，
 * 各自 path 保持不变；不设置时行为与线上完全一致。
 * 这是「零配额消耗」的保证开关：请求去向由配置决定，不依赖调用方自觉。
 */
const apiBaseOverride = (process.env.ZHIHU_API_BASE || '').trim().replace(/\/+$/, '');

function withApiBase(fullUrl) {
  if (!apiBaseOverride) return fullUrl;
  const u = new URL(fullUrl);
  const b = new URL(apiBaseOverride);
  u.protocol = b.protocol;
  u.host = b.host;
  return u.toString();
}

export const config = {
  port: int(process.env.PORT, 3000),
  // 监听地址：本地开发固定回环；容器/云平台部署必须设 HOST=0.0.0.0，
  // 否则服务只在容器内部可达，外部路由与健康检查全部落空。
  host: process.env.HOST || '127.0.0.1',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:3000',

  accessSecret: normalizeSecret(process.env.ZHIHU_ACCESS_SECRET),

  oauth: {
    appId: process.env.ZHIHU_OAUTH_APP_ID || '',
    appKey: process.env.ZHIHU_OAUTH_APP_KEY || '',
    redirectUri:
      process.env.ZHIHU_OAUTH_REDIRECT_URI ||
      'http://127.0.0.1:3000/api/auth/callback',
    authorizeUrl: withApiBase('https://openapi.zhihu.com/authorize'),
    tokenUrl: withApiBase('https://openapi.zhihu.com/access_token'),
    userUrl: withApiBase('https://openapi.zhihu.com/user'),
  },

  openApiBase: apiBaseOverride || 'https://developer.zhihu.com',

  freeSlotQuota: int(process.env.FREE_SLOT_QUOTA, 3),
  profileWindowDays: int(process.env.PROFILE_WINDOW_DAYS, 60),
  loginSuccessRedirect: process.env.LOGIN_SUCCESS_REDIRECT || '/',

  // 任务五：平台画像探测开关（recommendQuestions 无 query，走 creator 池 100/天）。
  // 缺省 off——默认路径 creator 消耗为 0；=1 时每用户每画像周期（24h 缓存）消耗 1 点 creator，
  // platform_recommendation 字段才返回官方平台画像原始结果。
  profilePlatformProbe: process.env.PROFILE_PLATFORM_PROBE === '1',

  // 缓存 TTL（毫秒）—— 依据实测额度设定，详见设计文档第 7 节
  cacheTtl: {
    hot: 45 * 60 * 1000,          // hot_list 每日仅 100，全站共享
    search: 2 * 60 * 60 * 1000,   // zhihu_search 每日 5000，较宽松
    questionRecommend: 6 * 60 * 60 * 1000, // creator 池每日 100
    questionAnswers: 6 * 60 * 60 * 1000,   // question_answers 每日 100
    tagVerify: 6 * 60 * 60 * 1000, // 任务五：标签搜索核验 qverify:，跨用户共享
    profile: 24 * 60 * 60 * 1000,
    daily: 60 * 60 * 1000,
  },

  sessionTtlMs: 12 * 60 * 60 * 1000,
  stateTtlMs: 10 * 60 * 1000,
};

/** 启动自检：返回缺失项清单，不抛异常，便于无凭证时也能起服务跑 Mock */
export function checkConfig() {
  const missing = [];
  if (!config.accessSecret) missing.push('ZHIHU_ACCESS_SECRET');
  if (!config.oauth.appId) missing.push('ZHIHU_OAUTH_APP_ID');
  if (!config.oauth.appKey) missing.push('ZHIHU_OAUTH_APP_KEY');
  return {
    ok: missing.length === 0,
    missing,
    canServeContent: Boolean(config.accessSecret),
    canServeOAuth: Boolean(config.oauth.appId && config.oauth.appKey),
  };
}

/** 脱敏，仅用于日志 */
export function mask(secret) {
  if (!secret) return '(unset)';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

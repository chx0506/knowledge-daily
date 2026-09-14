// 会话与 OAuth state 管理
// 浏览器只拿到随机会话 ID；OAuth token 始终留在服务端内存。
import crypto from 'node:crypto';
import { config } from './config.js';

const sessions = new Map(); // sid -> { oauthToken, tokenExpiresAt, user, createdAt, expiresAt }
const states = new Map();   // state -> { expiresAt, consumed }

const rand = () => crypto.randomBytes(32).toString('base64url');

// ---------------- state（CSRF 防护）----------------
// 黑客松 OAuth 已支持 state 原样透传，必须校验。

export function issueState() {
  const state = rand();
  states.set(state, { expiresAt: Date.now() + config.stateTtlMs, consumed: false });
  sweepStates();
  return state;
}

/**
 * 校验并原子消费 state。
 * 缺失、不匹配、过期、已使用 —— 一律拒绝。
 */
export function consumeState(state) {
  if (!state) return { ok: false, reason: 'state_missing' };
  const rec = states.get(state);
  if (!rec) return { ok: false, reason: 'state_unknown' };
  if (rec.consumed) { states.delete(state); return { ok: false, reason: 'state_replayed' }; }
  if (Date.now() > rec.expiresAt) { states.delete(state); return { ok: false, reason: 'state_expired' }; }
  rec.consumed = true;
  states.delete(state); // 原子消费，防重放
  return { ok: true };
}

function sweepStates() {
  const now = Date.now();
  for (const [k, v] of states) if (now > v.expiresAt) states.delete(k);
}

// ---------------- 会话 ----------------

export function createSession({ oauthToken, expiresIn, user }) {
  const sid = rand();
  const now = Date.now();
  sessions.set(sid, {
    oauthToken,
    tokenExpiresAt: now + expiresIn * 1000,
    user,
    createdAt: now,
    expiresAt: now + config.sessionTtlMs,
  });
  sweepSessions();
  return sid;
}

export function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(sid); return null; }
  return s;
}

/** token 是否已过期。过期时停止读取，不回退到本人账号 */
export function isTokenExpired(session) {
  return !session || Date.now() >= session.tokenExpiresAt;
}

export function destroySession(sid) {
  if (sid) sessions.delete(sid);
}

function sweepSessions() {
  const now = Date.now();
  for (const [k, v] of sessions) if (now > v.expiresAt) sessions.delete(k);
}

export function sessionStats() {
  sweepSessions();
  sweepStates();
  return { sessions: sessions.size, pendingStates: states.size };
}

// ---------------- Cookie ----------------

export const SESSION_COOKIE = 'dzbz_sid';

export function buildSessionCookie(sid, { secure }) {
  const parts = [
    `${SESSION_COOKIE}=${sid}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie({ secure }) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

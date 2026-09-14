// 带 TTL 的内存缓存 + 同 key 并发去重（防止冷启动时把 100 额度池打爆）
const store = new Map();   // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * 缓存优先执行。同一 key 的并发请求只真正发起一次远端调用。
 * 这是配额保护的关键：100 额度的池经不起并发放大。
 */
export async function withCache(key, ttlMs, producer) {
  const cached = cacheGet(key);
  if (cached !== undefined) return { value: cached, cached: true };

  if (inflight.has(key)) {
    return { value: await inflight.get(key), cached: true };
  }

  const task = (async () => {
    const value = await producer();
    cacheSet(key, value, ttlMs);
    return value;
  })();

  inflight.set(key, task);
  try {
    const value = await task;
    return { value, cached: false };
  } finally {
    inflight.delete(key);
  }
}

/** 取过期值用于降级（配额耗尽时返回上一期内容） */
export function cacheGetStale(key) {
  const hit = store.get(key);
  return hit ? hit.value : undefined;
}

/**
 * 按 key 前缀取「上一期」值（取 expiresAt 最新的一条）。
 * 用于日报 stale 降级：偏好/反馈/标签变化会改变精确 cacheKey，
 * 但「上一期日报」不该因此找不回来 —— 任何一期真实生成过的日报都优于空窗。
 */
export function cacheGetStaleByPrefix(prefix) {
  let best;
  for (const [k, v] of store) {
    if (!k.startsWith(prefix)) continue;
    if (!best || v.expiresAt > best.expiresAt) best = v;
  }
  return best?.value;
}

export function cacheStats() {
  let alive = 0;
  const now = Date.now();
  for (const v of store.values()) if (now <= v.expiresAt) alive += 1;
  return { total: store.size, alive, inflight: inflight.size };
}

export function cacheClear() {
  store.clear();
  inflight.clear();
}

/**
 * 后端 HTTP 客户端。
 * 开发环境通过 Vite proxy（/api → VITE_API_TARGET，默认 http://127.0.0.1:3000）绕开 CORS。
 *  fixture 开关：URL 加 ?fixture=1 或 localStorage["kd.fixture"]="1" 时强制离线样例。
 */
import type {
  RemoteAuthMe,
  RemoteDaily,
  RemoteFeedback,
  RemoteHealth,
  RemoteProfile,
  RemoteTopicDossier,
  RemoteUserPreferences,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isQuota(): boolean {
    return this.status === 429;
  }
}

const FIXTURE_KEY = "kd.fixture";
const DEFAULT_TIMEOUT_MS = 9000;

/** 显式 fixture 模式：?fixture=1 或 localStorage kd.fixture=1（?fixture=0 可清除）。 */
export function isFixtureForced(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("fixture");
    if (flag === "1" || flag === "true") {
      window.localStorage.setItem(FIXTURE_KEY, "1");
      return true;
    }
    if (flag === "0" || flag === "false") {
      window.localStorage.removeItem(FIXTURE_KEY);
      return false;
    }
    return window.localStorage.getItem(FIXTURE_KEY) === "1";
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const err = body as { error?: string; message?: string };
      throw new ApiError(response.status, err.message ?? `HTTP ${response.status}`, err.error);
    }
    return body as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  health(): Promise<RemoteHealth> {
    return request<RemoteHealth>("/api/health", {}, 4000);
  },

  profile(): Promise<RemoteProfile> {
    return request<RemoteProfile>("/api/profile");
  },

  getPreferences(): Promise<{ preferences: RemoteUserPreferences; options?: string[] }> {
    return request("/api/profile/preferences");
  },

  savePreferences(preferences: RemoteUserPreferences): Promise<{ ok: boolean }> {
    return request("/api/profile/preferences", { method: "POST", body: JSON.stringify(preferences) });
  },

  daily(options: { domains?: number; ai?: boolean } = {}, timeoutMs = 90000): Promise<RemoteDaily> {
    const params = new URLSearchParams();
    if (options.domains) params.set("domains", String(options.domains));
    if (options.ai === false) params.set("ai", "false");
    const query = params.toString();
    return request<RemoteDaily>(`/api/daily${query ? `?${query}` : ""}`, {}, timeoutMs);
  },

  regenerateDaily(options: { domains?: number } = {}, timeoutMs = 120000): Promise<RemoteDaily> {
    return request<RemoteDaily>(
      "/api/daily/regenerate",
      { method: "POST", body: JSON.stringify({ domains: options.domains ?? 3 }) },
      timeoutMs,
    );
  },

  feedback(cardId: string, topic: string, feedback: RemoteFeedback): Promise<{ ok: boolean }> {
    return request("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId, topic, feedback }),
    });
  },

  topic(topic: string, timeoutMs = 90000): Promise<RemoteTopicDossier> {
    return request<RemoteTopicDossier>(`/api/topic/${encodeURIComponent(topic)}`, {}, timeoutMs);
  },

  authMe(): Promise<RemoteAuthMe> {
    return request<RemoteAuthMe>("/api/auth/me", {}, 5000);
  },
};

export const AUTH_LOGIN_URL = "/api/auth/login";

/**
 * 后端契约类型（schema 4.0）。
 * 以 dianzi-baozhi-data-api 的实际响应为准，只做读取，不在前端二次加工。
 */

/** 后端 10 领域目录（/api/health 的 domain_catalog）。`(string & {})` 兜底未来新增领域。 */
export type RemoteDomainId =
  | "tech"
  | "finance"
  | "china"
  | "world"
  | "life"
  | "culture"
  | "gaming"
  | "design"
  | "science"
  | "travel"
  | (string & {});

export type RemoteSourceType = "关注" | "收藏" | "创作" | "搜索" | string;

export interface RemoteTagEvidence {
  type: string;
  label: string;
  url: string;
}

export interface RemoteProfileTag {
  name: string;
  weight: number;
  source: string;
  confidence_tier: string;
  contributing_signals?: string[];
  evidence?: RemoteTagEvidence[];
}

export interface RemoteUserPreferences {
  directions: string[];
  keywords: string[];
  goal: string;
  blocked: string[];
}

export interface RemotePlatformRecommendation {
  source: string;
  note: string;
  items: Array<{ title: string; url: string }>;
}

export interface RemoteSignalCoverage {
  followees: number;
  favorite_lists: number;
  favorite_items: number;
  own_contents: number;
  user_directions: number;
  feedback_records: number;
}

export interface RemoteProfile {
  user_ref: string;
  generated_at?: number;
  window_days?: number;
  summary?: string;
  confidence: string;
  confidence_reason: string;
  cold_start: boolean;
  tags: RemoteProfileTag[];
  user_preferences: RemoteUserPreferences;
  platform_recommendation?: RemotePlatformRecommendation;
  signal_coverage?: RemoteSignalCoverage;
  unavailable_signals?: string[];
  warnings?: string[];
  cached?: boolean;
  cold_start_options?: string[];
}

export interface RemoteMainline {
  judgement: string;
  first_read: { domain_id: RemoteDomainId; name: string; reason: string } | null;
  basis_text: string;
  total_synthesized: number;
}

export interface RemoteBasis {
  text: string;
  signals?: Record<string, number>;
  synthesized_count: number;
  breakdown?: { search?: number; personal?: number; question_answers?: number };
  hot_discovery_only?: boolean;
}

export interface RemoteRecommended {
  source_id: string;
  title: string;
  author: string;
  source_type: RemoteSourceType;
  why_now: string;
  url: string;
}

export interface RemoteSourceIndexItem {
  source_id: string;
  title: string;
  source_type: RemoteSourceType;
  url: string;
  cited: boolean;
}

export interface RemoteDomainReport {
  domain_id: RemoteDomainId;
  name: string;
  tier: "deep" | "standard" | "blind";
  /** 补盲召回模式：profile_anchored=关联拓展 / cold_start=真冷启动，仅 tier=blind 时出现。 */
  blind_mode?: "profile_anchored" | "cold_start";
  basis: RemoteBasis;
  judgement: string;
  report: string;
  recommended: RemoteRecommended[];
  source_index: RemoteSourceIndexItem[];
  generated_by: "zhida" | "rule_fallback" | string;
}

export interface RemoteSkippedDomain {
  domain_id: RemoteDomainId;
  name: string;
  reason: string;
}

export interface RemoteDaily {
  schema_version: string;
  daily_id: string;
  date: string;
  generated_at?: number;
  user_ref: string;
  data_source?: { platform?: string; auth_mode?: string; curation?: string };
  profile: RemoteProfile;
  mainline: RemoteMainline;
  domains: RemoteDomainReport[];
  skipped_domains: RemoteSkippedDomain[];
  /** 补盲开关回显：with_blind=含关联拓展补盲 / signal_only=只看我的方向（blind=0）。 */
  fill_mode?: "with_blind" | "signal_only";
  stale: boolean;
  stale_reason?: string;
  warnings: string[];
  cached?: boolean;
}

export interface RemoteTopicDossier extends RemoteDomainReport {
  schema_version?: string;
  type: "topic_dossier";
  topic: string;
  generated_at?: number;
  warnings?: string[];
}

export interface RemoteHealth {
  ok: boolean;
  schema_version?: string;
  capabilities?: { content_api?: boolean; oauth_login?: boolean; ai_curation?: boolean };
  /** 后端领域目录（当前 10 个 domain_id）。 */
  domain_catalog?: string[];
  missing_env?: string[];
}

export interface RemoteAuthMe {
  logged_in: boolean;
  reason?: string;
  login_url?: string;
  user?: { user_ref: string; fullname: string; headline?: string; avatar?: string };
}

export type RemoteFeedback =
  | "interested"
  | "want_more"
  | "read"
  | "mastered"
  | "review_later"
  | "irrelevant";

/** 前端附加在映射结果上的运行状态（不进后端契约）。 */
export type EditionSource = "live" | "stale" | "fixture";

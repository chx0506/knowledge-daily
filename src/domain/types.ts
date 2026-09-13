export type Platform = "zhihu" | "web" | "hot";

export type RouteName =
  | "home"
  | "domain"
  | "calendar"
  | "discover"
  | "mine"
  | "onboard"
  | "loading"
  | "result"
  | "menu"
  | "detail"
  | "history";

export type ScreenTheme = "paper" | "dark" | "cover";

export type DomainId =
  | "recommend"
  | "domestic"
  | "world"
  | "finance"
  | "tech"
  | "life"
  | "culture";

export type DomainVariant = "cover" | "special" | "card";

export interface DomainMeta {
  id: DomainId;
  name: string;
  nameEn: string;
  no: string;
  kicker: string;
  image: string;
  views: string;
  variant: DomainVariant;
  sideLines?: string[];
}

export interface DomainReading {
  title: string;
  source: string;
  why: string;
  url: string;
  /** 后端 source_type：关注 | 收藏 | 创作 | 搜索，用于徽标展示。 */
  sourceType?: string;
  /** 后端 source_id，阅读反馈（/api/feedback）的 card_id。 */
  cardId?: string;
}

export interface DomainStory {
  id: string;
  domainId: DomainId;
  title: string;
  dek: string;
  body: string;
  bullets: string[];
  sourceCount: number;
  readMinutes: number;
  sourceUrl?: string;
  heat?: string;
  evidence?: string;
  judgment?: string;
  briefing?: string[];
  readings?: DomainReading[];
  indexNote?: string;
  /** 后端篇幅档位：deep | standard | blind（补盲）。 */
  tier?: "deep" | "standard" | "blind";
  /** 后端反馈用的卡片 id（source_id / card_id）。 */
  cardId?: string;
}

export interface DomainBlock {
  domainId: DomainId;
  lead: DomainStory;
  items: DomainStory[];
}

/** 后端今日未生成的领域（Tab 置灰并展示原因）。 */
export interface SkippedDomain {
  id: DomainId;
  name: string;
  reason: string;
}

export interface DailyPaper {
  id: string;
  date: string;
  displayDate: string;
  monthLabel: string;
  weekday: string;
  lunar?: string;
  issueNo: number;
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    asideTitle: string;
    asidePoints: string[];
    storyId: string;
  };
  top5: Array<{
    storyId: string;
    title: string;
    domainId: DomainId;
    heat: string;
  }>;
  domains: DomainBlock[];
  quote: string;
  cover: {
    kicker: string;
    headline: string;
    stats: string;
  };
  /** 本期今日未覆盖的领域。 */
  skipped?: SkippedDomain[];
  /** 后端 stale 标记：额度耗尽，展示的是上一期缓存。 */
  stale?: boolean;
  /** 需要提示条展示的告警（含 stale_reason）。 */
  warnings?: string[];
  /** 本期来源：live 实时 / stale 过期缓存 / fixture 离线样例。 */
  origin?: "live" | "stale" | "fixture";
}

export type BriefLength = "short" | "full";

export interface UserProfile {
  quotaUsed: number;
  quotaTotal: number;
  topics: string[];
  readerName: string;
  briefLength: BriefLength;
  morningPush: boolean;
  weekendSkip: boolean;
}

export type InterestVerdict = "like" | "pass";

export type InterestCardTone = "navy" | "red" | "paper";

export interface InterestCard {
  id: string;
  author: string;
  role: string;
  city: string;
  title: string;
  summary: string;
  topics: string[];
  highlights: string[];
  collected: number;
  viewpoints: number;
  image: string;
  tone: InterestCardTone;
}

export interface InterestProfile {
  topics: string[];
  keywords: string[];
}

export interface ScoreBreakdown {
  interest: number;
  quality: number;
  recency: number;
  viewpoint: number;
  learning: number;
}

export interface CandidateArticle {
  id: string;
  title: string;
  platform: Platform;
  url: string;
  publishedAt: string;
  scores: ScoreBreakdown;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: "wait" | "active" | "done";
  detail: string;
}

export interface PipelineProgress {
  steps: PipelineStep[];
}

/* ---------- 后端画像 / 专题策展视图模型（screens 直接消费） ---------- */

export interface ProfileTagView {
  name: string;
  weight: number;
  source: string;
  confidenceTier: string;
  evidence: Array<{ label: string; url: string }>;
}

export interface ProfileView {
  summary: string;
  confidence: string;
  confidenceReason: string;
  coldStart: boolean;
  tags: ProfileTagView[];
  directions: string[];
  keywords: string[];
  goal: string;
  blocked: string[];
  platformItems: Array<{ title: string; url: string }>;
  platformNote: string;
  coverage: Array<{ label: string; value: number }>;
}

export interface DossierView {
  topic: string;
  title: string;
  judgement: string;
  basisText: string;
  report: string[];
  readings: DomainReading[];
  sourceCount: number;
  generatedBy: string;
  warnings: string[];
}

export interface AuthView {
  state: "unknown" | "out" | "in";
  name?: string;
  /** 后端未配置 OAuth 凭证时为 false，登录入口置灰。 */
  oauthReady: boolean;
}

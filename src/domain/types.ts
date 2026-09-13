export type Platform = "zhihu" | "web" | "hot";

export type RouteName =
  | "home"
  | "domain"
  | "calendar"
  | "discover"
  | "mine"
  | "map"
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
}

export interface DomainBlock {
  domainId: DomainId;
  lead: DomainStory;
  items: DomainStory[];
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
    titleLines?: string[];
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

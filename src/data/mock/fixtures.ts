import type { UserProfile } from "@/domain/types";

export const TOPIC_OPTIONS = [
  "科技",
  "商业",
  "AI",
  "游戏",
  "文化",
  "影视",
  "社会",
  "设计",
  "生活",
  "财经",
  "科学",
  "旅行",
] as const;

export const DEFAULT_TOPICS = ["科技", "AI", "文化"];

export const defaultProfile: UserProfile = {
  quotaUsed: 3,
  quotaTotal: 3,
  topics: [...DEFAULT_TOPICS],
  readerName: "看山订户",
  briefLength: "short",
  morningPush: true,
  weekendSkip: false,
};

import type { CandidateArticle, InterestProfile } from "@/domain/types";
import type { ContentProvider } from "./types";

const CANDIDATES: CandidateArticle[] = [
  {
    id: "agent-workflow",
    title: "AI Agent 正在进入真实工作流",
    platform: "zhihu",
    url: "https://www.zhihu.com",
    publishedAt: "2026-09-13T09:18:00+08:00",
    scores: { interest: 0.92, quality: 0.88, recency: 0.95, viewpoint: 0.86, learning: 0.9 },
  },
  {
    id: "multimodal",
    title: "OpenAI 发布新一代多模态模型",
    platform: "zhihu",
    url: "https://www.zhihu.com",
    publishedAt: "2026-09-13T08:40:00+08:00",
    scores: { interest: 0.8, quality: 0.84, recency: 0.97, viewpoint: 0.72, learning: 0.7 },
  },
  {
    id: "agent-cost",
    title: "关注的人在讨论 Agent 落地成本",
    platform: "zhihu",
    url: "https://www.zhihu.com",
    publishedAt: "2026-09-13T07:10:00+08:00",
    scores: { interest: 0.94, quality: 0.8, recency: 0.86, viewpoint: 0.91, learning: 0.78 },
  },
];

export const mockProvider: ContentProvider = {
  id: "mock",
  async recall(profile: InterestProfile) {
    if (profile.topics.length === 0) return CANDIDATES;
    return CANDIDATES.filter((item) =>
      profile.topics.some((topic) => item.title.includes(topic) || topic === "AI" || topic === "科技"),
    );
  },
};

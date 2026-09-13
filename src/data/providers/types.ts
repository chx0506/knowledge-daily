import type { CandidateArticle, InterestProfile } from "@/domain/types";

export interface ContentProvider {
  id: string;
  recall(profile: InterestProfile): Promise<CandidateArticle[]>;
}

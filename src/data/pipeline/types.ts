import type { DailyPaper, InterestProfile, PipelineProgress } from "@/domain/types";

export interface CurationPipeline {
  run(
    profile: InterestProfile,
    onProgress?: (progress: PipelineProgress) => void,
  ): Promise<DailyPaper>;
}

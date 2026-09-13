import { archiveRepo } from "@/data/repositories/archive-repo";
import { listProviders } from "@/data/providers/registry";
import { rankCandidates } from "@/domain/scoring";
import type { DailyPaper, InterestProfile, PipelineStep } from "@/domain/types";
import type { CurationPipeline } from "./types";

const STEP_DEFS: Array<Omit<PipelineStep, "status" | "detail"> & { detail: (count: number) => string; ms: number }> = [
  { id: "recall", label: "收集全球资讯", detail: (n) => `${n} 篇`, ms: 280 },
  { id: "theme", label: "识别主题与分类", detail: () => "进行中…", ms: 360 },
  { id: "dedupe", label: "合并相似内容", detail: () => "进行中…", ms: 280 },
  { id: "summary", label: "生成摘要", detail: () => "进行中…", ms: 320 },
  { id: "layout", label: "编辑排版", detail: () => "进行中…", ms: 260 },
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const mockPipeline: CurationPipeline = {
  async run(profile: InterestProfile, onProgress) {
    const recalled = (
      await Promise.all(listProviders().map((provider) => provider.recall(profile)))
    ).flat();
    const ranked = rankCandidates(recalled);
    const count = Math.max(ranked.length, 128);

    const steps: PipelineStep[] = STEP_DEFS.map((step, index) => ({
      id: step.id,
      label: step.label,
      status: index === 0 ? "active" : "wait",
      detail: index === 0 ? step.detail(count) : "等待中…",
    }));

    const emit = () => onProgress?.({ steps: steps.map((step) => ({ ...step })) });
    emit();

    for (let i = 0; i < STEP_DEFS.length; i += 1) {
      steps[i].status = "active";
      steps[i].detail = STEP_DEFS[i].detail(count);
      emit();
      await wait(STEP_DEFS[i].ms);
      steps[i].status = "done";
      steps[i].detail = i === 0 ? `${count} 篇` : "完成";
      emit();
    }

    const today = archiveRepo.today();
    const edition: DailyPaper = {
      ...today,
      cover: {
        ...today.cover,
        stats: `编排完成 ${new Date().toTimeString().slice(0, 5)}　　领域 06　来源 ${count}`,
      },
    };
    return edition;
  },
};

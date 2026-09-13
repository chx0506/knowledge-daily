import { archiveRepo } from "./archive-repo";
import type { DailyPaper } from "@/domain/types";

export interface EditionRepo {
  getToday(): Promise<DailyPaper>;
  getArchive(): Promise<DailyPaper[]>;
}

export const editionRepo: EditionRepo = {
  async getToday() {
    return archiveRepo.today();
  },
  async getArchive() {
    return archiveRepo.load();
  },
};

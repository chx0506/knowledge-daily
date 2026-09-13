import { TODAY, seedPapers } from "@/data/mock/papers";
import type { DailyPaper } from "@/domain/types";

export const ARCHIVE_KEY = "kd.archive.v2";

function sortPapers(papers: DailyPaper[]): DailyPaper[] {
  return [...papers].sort((a, b) => b.date.localeCompare(a.date));
}

export interface ArchiveRepo {
  load(): DailyPaper[];
  save(papers: DailyPaper[]): DailyPaper[];
  upsert(paper: DailyPaper): DailyPaper[];
  today(): DailyPaper;
}

export const archiveRepo: ArchiveRepo = {
  load() {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      const stored = raw ? (JSON.parse(raw) as DailyPaper[]) : [];
      const map = new Map<string, DailyPaper>();
      for (const paper of stored) map.set(paper.date, paper);
      for (const paper of seedPapers) map.set(paper.date, paper);
      const merged = sortPapers([...map.values()]);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      return sortPapers(seedPapers);
    }
  },
  save(papers: DailyPaper[]) {
    const next = sortPapers(papers);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
    return next;
  },
  upsert(paper: DailyPaper) {
    const current = archiveRepo.load().filter((item) => item.date !== paper.date);
    return archiveRepo.save([paper, ...current]);
  },
  today() {
    const papers = archiveRepo.load();
    return papers.find((item) => item.date === TODAY) ?? papers[0];
  },
};

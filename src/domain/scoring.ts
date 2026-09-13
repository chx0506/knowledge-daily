import type { ScoreBreakdown } from "./types";

const WEIGHTS = {
  interest: 0.3,
  quality: 0.25,
  recency: 0.15,
  viewpoint: 0.15,
  learning: 0.15,
} as const;

export function recommendScore(scores: ScoreBreakdown): number {
  return (
    scores.interest * WEIGHTS.interest +
    scores.quality * WEIGHTS.quality +
    scores.recency * WEIGHTS.recency +
    scores.viewpoint * WEIGHTS.viewpoint +
    scores.learning * WEIGHTS.learning
  );
}

export function rankCandidates<T extends { scores: ScoreBreakdown }>(items: T[]): T[] {
  return [...items].sort((a, b) => recommendScore(b.scores) - recommendScore(a.scores));
}

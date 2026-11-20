import { MAX_QUESTIONS, type Step } from "@/lib/types";
import { bestQuestion } from "./infoGain";
import { posterior, topCandidates, type Knowledge } from "./posterior";

export { buildKnowledge, type LearnedStat } from "./knowledge";
export { expectedInfoGain, bestQuestion } from "./infoGain";
export {
  posterior,
  likelihood,
  entropy,
  topCandidates,
  type Knowledge,
  type Counts,
} from "./posterior";

export type EngineOptions = {
  /** En olası aday bu olasılığı geçince tahmin edilir. */
  threshold: number;
  /** Beklenen kazancı bunun altındaki soru sorulmaz; motor tahmine geçer. */
  minGain: number;
  maxQuestions: number;
};

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  threshold: 0.6,
  minGain: 0.05,
  maxQuestions: MAX_QUESTIONS,
};

export type Ranked = { name: string; key: string; p: number }[];

export type Decision =
  | { kind: "question"; id: string; gain: number }
  | { kind: "guess"; ranked: Ranked; reason: "confident" | "exhausted" };

/**
 * Motorun tek adımı. Saf fonksiyon: aynı bilgi ve adımlarla hep aynı kararı verir.
 * `steps` soru kimlikleri kanonik olmalı.
 */
export function decide(
  knowledge: Knowledge,
  pool: { id: string }[],
  steps: Step[],
  options: EngineOptions = DEFAULT_ENGINE_OPTIONS,
): Decision {
  const p = posterior(knowledge, steps);
  const ranked = topCandidates(knowledge, p, 5);
  if (ranked.length > 0 && ranked[0].p >= options.threshold) {
    return { kind: "guess", ranked, reason: "confident" };
  }
  if (steps.length >= options.maxQuestions) return { kind: "guess", ranked, reason: "exhausted" };

  const asked = new Set(steps.map((s) => s.q));
  const best = bestQuestion(knowledge, p, pool, asked);
  if (!best || best.gain < options.minGain) return { kind: "guess", ranked, reason: "exhausted" };
  return { kind: "question", id: best.id, gain: best.gain };
}

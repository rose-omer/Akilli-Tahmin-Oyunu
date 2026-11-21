import { ANSWERS } from "@/lib/types";
import { entropy, likelihood, type Knowledge } from "./posterior";

/**
 * Beklenen bilgi kazancı (bit): IG(q) = H(p) − Σ_a P(a) · H(p | a)
 * P(a) = Σ_e p(e) · P(a | e, q)
 */
export function expectedInfoGain(knowledge: Knowledge, p: number[], questionId: string): number {
  const before = entropy(p);
  let after = 0;
  for (const answer of ANSWERS) {
    const joint = p.map((pe, i) => pe * likelihood(knowledge.counts[i].get(questionId), answer));
    const pa = joint.reduce((a, b) => a + b, 0);
    if (pa <= 0) continue;
    after += pa * entropy(joint.map((v) => v / pa));
  }
  return before - after;
}

/** Sorulmamış sorular içinde kazancı en yüksek olanı seçer. Eşitlikte havuz sırası korunur. */
export function bestQuestion(
  knowledge: Knowledge,
  p: number[],
  pool: { id: string }[],
  asked: ReadonlySet<string>,
): { id: string; gain: number } | null {
  let best: { id: string; gain: number } | null = null;
  for (const q of pool) {
    if (asked.has(q.id)) continue;
    const gain = expectedInfoGain(knowledge, p, q.id);
    if (!best || gain > best.gain + 1e-12) best = { id: q.id, gain };
  }
  return best;
}

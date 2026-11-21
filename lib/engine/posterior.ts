import type { Answer, Step } from "@/lib/types";

export type Counts = { yes: number; no: number; unknown: number };

/** Motorun bildikleri: varlıklar ve her varlık için soru başına cevap sayaçları. */
export type Knowledge = {
  entities: { key: string; name: string }[];
  /** counts[varlıkSırası].get(soruKimliği) */
  counts: Map<string, Counts>[];
};

/** Laplace düzeltmesi: hiç görülmemiş cevabın olasılığı sıfır olmaz. */
export const LAPLACE_ALPHA = 1;

const field = { evet: "yes", hayır: "no", bilmiyorum: "unknown" } as const satisfies Record<
  Answer,
  keyof Counts
>;

/** P(cevap | varlık, soru) = (sayaç[cevap] + α) / (toplam + 3α) */
export function likelihood(counts: Counts | undefined, answer: Answer): number {
  const c = counts ?? { yes: 0, no: 0, unknown: 0 };
  const total = c.yes + c.no + c.unknown;
  return (c[field[answer]] + LAPLACE_ALPHA) / (total + 3 * LAPLACE_ALPHA);
}

/** Tekdüze öncülden başlar, her cevabı Bayes kuralıyla işler. Sonuç toplamı 1 olan dizi. */
export function posterior(knowledge: Knowledge, steps: Step[]): number[] {
  const n = knowledge.entities.length;
  if (n === 0) return [];
  const logp = new Array<number>(n).fill(-Math.log(n));
  for (const step of steps) {
    for (let i = 0; i < n; i++) {
      logp[i] += Math.log(likelihood(knowledge.counts[i].get(step.q), step.a));
    }
  }
  return normalizeLog(logp);
}

export function normalizeLog(logp: number[]): number[] {
  const max = Math.max(...logp);
  const exp = logp.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

export function entropy(p: number[]): number {
  let h = 0;
  for (const v of p) if (v > 0) h -= v * Math.log2(v);
  return h;
}

/** Olasılığa göre sıralı ilk `k` aday. */
export function topCandidates(knowledge: Knowledge, p: number[], k: number) {
  return p
    .map((prob, i) => ({
      name: knowledge.entities[i].name,
      key: knowledge.entities[i].key,
      p: prob,
    }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k);
}

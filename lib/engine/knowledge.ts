import { normalizeName } from "@/lib/text";
import type { Step } from "@/lib/types";
import type { Counts, Knowledge } from "./posterior";

export type LearnedStat = {
  name: string;
  questionId: string;
  yes: number;
  no: number;
  unknown: number;
};

/** Ağaç yolundan gelen bilgi, birkaç gerçek oyun kadar ağırlık taşır. */
export const TREE_PRIOR_WEIGHT = 10;

const add = (a: Counts | undefined, b: Counts): Counts => ({
  yes: (a?.yes ?? 0) + b.yes,
  no: (a?.no ?? 0) + b.no,
  unknown: (a?.unknown ?? 0) + b.unknown,
});

/**
 * Motorun bilgisini kurar:
 * 1. Ağaç yolları ön bilgi verir (Aslan için "Hayvan mı?" → evet).
 * 2. Kayıtlı oyunların sayaçları üstüne eklenir.
 * `canonical`: aynı metinli soruları tek kimliğe indirger.
 */
export function buildKnowledge(input: {
  treePaths: { name: string; path: Step[] }[];
  learned: LearnedStat[];
  canonical?: Map<string, string>;
  treeWeight?: number;
}): Knowledge {
  const weight = input.treeWeight ?? TREE_PRIOR_WEIGHT;
  const canon = (id: string) => input.canonical?.get(id) ?? id;
  const index = new Map<string, number>();
  const knowledge: Knowledge = { entities: [], counts: [] };

  const slot = (name: string) => {
    const key = normalizeName(name);
    let i = index.get(key);
    if (i === undefined) {
      i = knowledge.entities.length;
      index.set(key, i);
      knowledge.entities.push({ key, name });
      knowledge.counts.push(new Map());
    }
    return i;
  };

  for (const { name, path } of input.treePaths) {
    const counts = knowledge.counts[slot(name)];
    for (const step of path) {
      const q = canon(step.q);
      const delta: Counts = {
        yes: step.a === "evet" ? weight : 0,
        no: step.a === "hayır" ? weight : 0,
        unknown: step.a === "bilmiyorum" ? weight : 0,
      };
      counts.set(q, add(counts.get(q), delta));
    }
  }

  for (const row of input.learned) {
    const counts = knowledge.counts[slot(row.name)];
    const q = canon(row.questionId);
    counts.set(q, add(counts.get(q), row));
  }
  return knowledge;
}

import { describe, expect, it } from "vitest";
import {
  bestQuestion,
  buildKnowledge,
  decide,
  DEFAULT_ENGINE_OPTIONS,
  entropy,
  expectedInfoGain,
  likelihood,
  posterior,
  type Knowledge,
} from "@/lib/engine";
import { guessPaths, isGuess, loadTree } from "@/lib/tree";
import type { Answer, Step } from "@/lib/types";

const counts = (yes: number, no: number, unknown = 0) => ({ yes, no, unknown });

function knowledgeOf(table: Record<string, Record<string, ReturnType<typeof counts>>>): Knowledge {
  const entities = Object.keys(table).map((name) => ({ key: name.toLowerCase(), name }));
  return { entities, counts: entities.map((e) => new Map(Object.entries(table[e.name]))) };
}

describe("sonsal güncelleme", () => {
  it("Laplace: görülmemiş cevap sıfır olmaz", () => {
    expect(likelihood(counts(4, 0), "hayır")).toBeCloseTo(1 / 7);
    expect(likelihood(counts(4, 0), "evet")).toBeCloseTo(5 / 7);
    expect(likelihood(undefined, "evet")).toBeCloseTo(1 / 3);
  });

  it("cevapla uyumlu varlığın olasılığı artar, toplam 1 kalır", () => {
    const k = knowledgeOf({ Kedi: { miyav: counts(5, 0) }, Kopek: { miyav: counts(0, 5) } });
    const p = posterior(k, [{ q: "miyav", a: "evet" }]);
    expect(p[0]).toBeGreaterThan(p[1]);
    expect(p[0] + p[1]).toBeCloseTo(1);
  });

  it("adım yoksa dağılım tekdüze", () => {
    const k = knowledgeOf({ A: {}, B: {}, C: {}, D: {} });
    expect(posterior(k, [])).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(entropy(posterior(k, []))).toBeCloseTo(2);
  });
});

describe("bilgi kazancı", () => {
  const k = knowledgeOf({
    A: { ayirt: counts(9, 0), sabit: counts(9, 0) },
    B: { ayirt: counts(0, 9), sabit: counts(9, 0) },
  });
  const p = posterior(k, []);

  it("ayırt eden soru, herkes için aynı cevaplı sorudan çok kazandırır", () => {
    expect(expectedInfoGain(k, p, "ayirt")).toBeGreaterThan(0.5);
    expect(expectedInfoGain(k, p, "sabit")).toBeCloseTo(0, 5);
  });

  it("en iyi soruyu seçer, sorulmuşları atlar", () => {
    const pool = [{ id: "sabit" }, { id: "ayirt" }];
    expect(bestQuestion(k, p, pool, new Set())?.id).toBe("ayirt");
    expect(bestQuestion(k, p, pool, new Set(["ayirt"]))?.id).toBe("sabit");
  });
});

describe("eşik", () => {
  const k = knowledgeOf({
    A: { q1: counts(9, 0), q2: counts(9, 0) },
    B: { q1: counts(0, 9), q2: counts(9, 0) },
    C: { q1: counts(0, 9), q2: counts(0, 9) },
  });
  const pool = [{ id: "q1" }, { id: "q2" }];

  it("eşik geçilmeden soru sorar, geçilince tahmin eder", () => {
    expect(decide(k, pool, []).kind).toBe("question");
    const d = decide(k, pool, [{ q: "q1", a: "evet" }]);
    expect(d.kind).toBe("guess");
    if (d.kind === "guess") {
      expect(d.reason).toBe("confident");
      expect(d.ranked[0].name).toBe("A");
    }
  });

  it("soru sınırında tahmine geçer", () => {
    const d = decide(k, pool, [{ q: "q2", a: "bilmiyorum" }], {
      ...DEFAULT_ENGINE_OPTIONS,
      maxQuestions: 1,
    });
    expect(d).toMatchObject({ kind: "guess", reason: "exhausted" });
  });
});

describe("ağaç ön bilgisi", () => {
  it("ağaç yolu motoru doğru varlığa götürür", () => {
    const tree = loadTree();
    const paths = guessPaths(tree);
    const k = buildKnowledge({ treePaths: paths, learned: [], canonical: tree.canonical });
    const kurt = paths.find((p) => p.name === "Kurt")!;
    const p = posterior(
      k,
      kurt.path.map((s) => ({ q: tree.canonical.get(s.q)!, a: s.a })),
    );
    const best = p.indexOf(Math.max(...p));
    expect(k.entities[best].name).toBe("Kurt");
  });

  it("kayıtlı oyun sayaçları ön bilginin üstüne eklenir", () => {
    const k = buildKnowledge({
      treePaths: [{ name: "Kedi", path: [{ q: "q", a: "evet" }] }],
      learned: [{ name: "kedi", questionId: "q", yes: 0, no: 3, unknown: 1 }],
      treeWeight: 4,
    });
    expect(k.entities).toHaveLength(1);
    expect(k.counts[0].get("q")).toEqual({ yes: 4, no: 3, unknown: 1 });
  });
});

/** Basit, tekrarlanabilir rastgele sayı üreteci (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("simülasyon: 50 sentetik varlık, gürültüsüz cevaplar", () => {
  it("motor ortalamada ağaçtan az soruyla doğru tahmine ulaşır", () => {
    const random = rng(42);
    const QUESTIONS = 40;
    const ENTITIES = 50;
    const pool = Array.from({ length: QUESTIONS }, (_, i) => ({ id: `s${i}` }));
    const truth = Array.from({ length: ENTITIES }, () =>
      pool.map(() => (random() < 0.5 ? "evet" : "hayır") as Answer),
    );
    // Her varlık için sorular 5 kez gözlenmiş gibi sayaç.
    const k: Knowledge = {
      entities: truth.map((_, i) => ({ key: `v${i}`, name: `V${i}` })),
      counts: truth.map(
        (answers) =>
          new Map(pool.map((q, j) => [q.id, answers[j] === "evet" ? counts(5, 0) : counts(0, 5)])),
      ),
    };

    let total = 0;
    let correct = 0;
    for (let e = 0; e < ENTITIES; e++) {
      const steps: Step[] = [];
      for (;;) {
        const d = decide(k, pool, steps);
        if (d.kind === "guess") {
          if (d.ranked[0].name === `V${e}`) correct++;
          break;
        }
        steps.push({ q: d.id, a: truth[e][Number(d.id.slice(1))] });
      }
      total += steps.length;
    }
    const engineAverage = total / ENTITIES;

    // Ağacın tahmin yapraklarına ortalama derinliği.
    const tree = loadTree();
    const depths = guessPaths(tree).map((p) => p.path.length);
    const treeAverage = depths.reduce((a, b) => a + b, 0) / depths.length;

    expect([...tree.nodes.values()].some(isGuess)).toBe(true);
    expect(correct / ENTITIES).toBeGreaterThanOrEqual(0.95);
    expect(engineAverage).toBeLessThan(treeAverage);
  });
});

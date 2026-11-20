import { createHash, randomUUID } from "node:crypto";
import {
  buildKnowledge,
  decide,
  DEFAULT_ENGINE_OPTIONS,
  posterior,
  topCandidates,
  type EngineOptions,
  type Knowledge,
  type Ranked,
} from "@/lib/engine";
import type { Env } from "@/lib/env";
import type { Guesser } from "@/lib/gemini";
import { createGuessSigner } from "@/lib/guessToken";
import { allowRequest } from "@/lib/rateLimit";
import {
  AnswerInputSchema,
  EntityNameSchema,
  FeedbackInputSchema,
  NextStepInputSchema,
} from "@/lib/schemas";
import type { GameStore, Learned, SavedQuestion } from "@/lib/store/types";
import { normalizeName } from "@/lib/text";
import { guessPaths, walkTree, type Tree } from "@/lib/tree";
import {
  MAX_QUESTIONS,
  type ActionResult,
  type GuessStep,
  type Mode,
  type NextStepResult,
  type QuestionStep,
  type Step,
} from "@/lib/types";

/** Soru aşamasında "Şüpheliler" panelinde gösterilen aday sayısı. */
const SUSPECT_COUNT = 4;

/** Motorun en iyi adayı bu olasılığın altındaysa ve Gemini varsa son söz Gemini'nin. */
export const WEAK_CANDIDATE = 0.35;
const LEARNED_CACHE_MS = 30_000;

class InvalidInputError extends Error {}

export type ServiceDeps = {
  tree: Tree;
  store: GameStore;
  guesser: Guesser | null;
  env: Pick<
    Env,
    "RATE_LIMIT_PER_MINUTE" | "ENGINE_MIN_GAMES" | "ENTITY_MIN_GAMES" | "IP_HASH_SALT"
  >;
  engine?: EngineOptions;
  now?: () => Date;
  logError?: (requestId: string, error: unknown) => void;
};

type Model = {
  knowledge: Knowledge;
  pool: { id: string; text: string }[];
  poolIds: Set<string>;
  games: number;
};

type UnsignedGuess = Omit<GuessStep, "token">;

/**
 * Motora giren sayaçları süzer. Ağaçta olmayan bir varlık, en az `minGames` oyunda
 * doğru cevap olarak geçmeden motoru etkilemez; tek kişi uydurma adla veriyi bozamaz.
 */
export function trustedStats(
  stats: Learned["stats"],
  treeNames: ReadonlySet<string>,
  minGames: number,
): Learned["stats"] {
  return stats.filter((s) => s.entityGames >= minGames || treeNames.has(normalizeName(s.name)));
}

export type GameService = ReturnType<typeof createGameService>;

export function createGameService(deps: ServiceDeps) {
  const { tree, store, guesser, env } = deps;
  const engineOptions = deps.engine ?? DEFAULT_ENGINE_OPTIONS;
  const now = deps.now ?? (() => new Date());
  const logError =
    deps.logError ??
    ((requestId: string, error: unknown) =>
      console.error(`[oyun] istek ${requestId} başarısız:`, error));
  const treePaths = guessPaths(tree);
  const treeNames = new Set(treePaths.map((p) => normalizeName(p.name)));
  const canonical = (id: string) => tree.canonical.get(id) ?? id;
  const signer = createGuessSigner(env.IP_HASH_SALT);

  let cache: { at: number; model: Model } | null = null;

  async function model(): Promise<Model> {
    const at = now().getTime();
    if (cache && at - cache.at < LEARNED_CACHE_MS) return cache.model;
    const learned = await store.loadLearned();
    const pool = [...tree.questions, ...learned.questions];
    const value: Model = {
      knowledge: buildKnowledge({
        treePaths,
        learned: trustedStats(learned.stats, treeNames, env.ENTITY_MIN_GAMES),
        canonical: tree.canonical,
      }),
      pool,
      poolIds: new Set(pool.map((q) => q.id)),
      games: learned.games,
    };
    cache = { at, model: value };
    return value;
  }

  const questionText = (m: Model, id: string) => {
    const node = tree.nodes.get(id);
    if (node && "text" in node) return node.text;
    return m.pool.find((q) => q.id === id)?.text ?? id;
  };

  /**
   * Adımları sunucu tarafında doğrular. Ağaç modunda adımlar kökten ağaç yolunu izler;
   * ağaç bitince motor sorularına geçer. Motor soruları havuzda olmalı, tekrar etmemeli.
   */
  function resolve(m: Model, mode: Mode, steps: Step[]) {
    let treeUsed = 0;
    let walk: ReturnType<typeof walkTree> | null = null;
    if (mode === "tree") {
      walk = walkTree(tree, steps);
      if (walk.status === "invalid") throw new InvalidInputError("Adımlar ağaç yoluna uymuyor.");
      treeUsed = walk.used;
    }
    const canonicalSteps = steps.map((s) => ({ q: canonical(s.q), a: s.a }));
    const engineIds = canonicalSteps.slice(treeUsed).map((s) => s.q);
    const seen = new Set(canonicalSteps.slice(0, treeUsed).map((s) => s.q));
    for (const id of engineIds) {
      if (!m.poolIds.has(id) || seen.has(id)) throw new InvalidInputError("Bilinmeyen soru.");
      seen.add(id);
    }
    return { walk, canonicalSteps };
  }

  function modelGuess(mode: Mode, ranked: Ranked): UnsignedGuess {
    return {
      kind: "guess",
      mode,
      answer: ranked[0]?.name ?? "Bilemedim",
      source: "model",
      confidence: ranked[0] ? Math.round(ranked[0].p * 100) / 100 : 0,
      alternatives: ranked.slice(1, 4).map((r) => r.name),
    };
  }

  async function finalGuess(
    m: Model,
    mode: Mode,
    steps: Step[],
    ranked: Ranked,
    reason: "confident" | "exhausted",
    requestId: string,
  ): Promise<UnsignedGuess> {
    const weak = reason === "exhausted" && (ranked[0]?.p ?? 0) < WEAK_CANDIDATE;
    if (weak && guesser) {
      try {
        const result = await guesser.guess({
          qa: steps.map((s) => ({ question: questionText(m, s.q), answer: s.a })),
          candidates: ranked.slice(0, 5).map((r) => r.name),
        });
        // Model çıktısı da kullanıcı girdisi gibi denetlenir: ad kuralına uymayan atılır.
        const valid = (s: string) => EntityNameSchema.safeParse(s).success;
        if (valid(result.guess)) {
          return {
            kind: "guess",
            mode,
            answer: result.guess.trim(),
            source: "gemini",
            confidence: result.confidence,
            alternatives: result.alternatives
              .filter(valid)
              .map((s) => s.trim())
              .slice(0, 3),
          };
        }
        logError(requestId, new Error("Gemini tahmini ad kuralına uymadı."));
      } catch (error) {
        logError(requestId, error);
      }
    }
    return modelGuess(mode, ranked);
  }

  /** Bir oyun adımı: ağaç yolu, ağaç yaprağı ya da motor kararı. */
  async function step(
    m: Model,
    mode: Mode,
    steps: Step[],
    requestId: string,
  ): Promise<QuestionStep | UnsignedGuess> {
    const { walk, canonicalSteps } = resolve(m, mode, steps);

    if (walk?.status === "question" && steps.length < MAX_QUESTIONS) {
      const ranked = topCandidates(
        m.knowledge,
        posterior(m.knowledge, canonicalSteps),
        SUSPECT_COUNT,
      );
      return {
        kind: "question",
        mode,
        questionId: walk.node.id,
        text: walk.node.text,
        candidates: ranked.map((r) => r.name),
      };
    }
    if (walk?.status === "guess") {
      // Ağaç yaprağı tahmin eder; alternatifleri motorun sıralaması verir.
      const guessKey = normalizeName(walk.node.guess);
      const alternatives = topCandidates(m.knowledge, posterior(m.knowledge, canonicalSteps), 4)
        .filter((r) => r.key !== guessKey)
        .slice(0, 3)
        .map((r) => r.name);
      return {
        kind: "guess",
        mode,
        answer: walk.node.guess,
        source: "tree",
        confidence: null,
        alternatives,
      };
    }

    const decision = decide(m.knowledge, m.pool, canonicalSteps, engineOptions);
    if (decision.kind === "question") {
      return {
        kind: "question",
        mode,
        questionId: decision.id,
        text: questionText(m, decision.id),
        candidates: decision.ranked.slice(0, SUSPECT_COUNT).map((r) => r.name),
      };
    }
    return finalGuess(m, mode, canonicalSteps, decision.ranked, decision.reason, requestId);
  }

  async function guard<T>(
    ip: string,
    run: (requestId: string) => Promise<T>,
  ): Promise<ActionResult<T>> {
    const requestId = randomUUID().slice(0, 8);
    try {
      const allowed = await allowRequest({
        store,
        ip,
        salt: env.IP_HASH_SALT,
        limit: env.RATE_LIMIT_PER_MINUTE,
        now: now(),
      });
      if (!allowed) return { ok: false, error: "rate_limited", requestId };
      return { ok: true, data: await run(requestId) };
    } catch (error) {
      if (error instanceof InvalidInputError) return { ok: false, error: "invalid", requestId };
      logError(requestId, error);
      return { ok: false, error: "server", requestId };
    }
  }

  const parse = <T>(
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
    input: unknown,
  ): T => {
    const result = schema.safeParse(input);
    if (!result.success) throw new InvalidInputError("Geçersiz girdi.");
    return result.data;
  };

  return {
    /** Sıradaki soruyu ya da tahmini döner. İstemci yalnız mod ve adımları gönderir. */
    nextStep(input: unknown, ip: string): Promise<ActionResult<NextStepResult>> {
      return guard(ip, async (requestId) => {
        const { mode: given, steps } = parse(NextStepInputSchema, input);
        if (!given && steps.length > 0) throw new InvalidInputError("Mod eksik.");
        const m = await model();
        const mode: Mode = given ?? (m.games >= env.ENGINE_MIN_GAMES ? "engine" : "tree");
        const result = await step(m, mode, steps, requestId);
        if (result.kind === "question") return result;
        // Tahmin, istemcinin gönderdiği adımlara bağlı imzalı jetonla döner.
        return {
          ...result,
          token: signer.sign({ mode, steps, answer: result.answer, source: result.source }, now()),
        };
      });
    },

    /** Tahmin geri bildirimini anında kaydeder. Doğruysa motor bu oyundan öğrenir. */
    submitFeedback(input: unknown, ip: string): Promise<ActionResult<{ gameId: string }>> {
      return guard(ip, async () => {
        const data = parse(FeedbackInputSchema, input);
        const claim = {
          mode: data.mode,
          steps: data.steps,
          answer: data.guess,
          source: data.source,
        };
        if (!signer.verify(claim, data.token, now())) {
          throw new InvalidInputError("Tahmin bu sunucudan gelmedi ya da süresi doldu.");
        }
        const m = await model();
        const { canonicalSteps } = resolve(m, data.mode, data.steps);
        const questions: SavedQuestion[] = canonicalSteps.map((s) => ({
          questionId: s.q,
          question: questionText(m, s.q),
          answer: s.a,
        }));
        const { id } = await store.createGame({
          mode: data.mode,
          prediction: data.guess,
          source: data.source,
          correct: data.correct,
          questions,
        });
        cache = null;
        return { gameId: id };
      });
    },

    /** Yanlış tahminden sonra doğru cevabı ekler; motor sayaçları güncellenir. */
    submitAnswer(input: unknown, ip: string): Promise<ActionResult<{ learned: true }>> {
      return guard(ip, async (requestId) => {
        const data = parse(AnswerInputSchema, input);
        const result = await store.recordAnswer({
          gameId: data.gameId,
          answer: data.answer,
          now: now(),
        });
        if (result.status !== "ok") throw new InvalidInputError("Oyun bulunamadı ya da kapandı.");
        cache = null;
        if (result.entityCreated && guesser) {
          // Yeni varlık: Gemini ayırt edici bir soru önerir; onaysız havuza girmez.
          try {
            const text = await guesser.suggestQuestion({
              entity: data.answer,
              confusedWith: result.prediction,
            });
            const id = `g_${createHash("sha256").update(normalizeName(text)).digest("hex").slice(0, 16)}`;
            await store.addSuggestedQuestion({ id, text });
          } catch (error) {
            logError(requestId, error);
          }
        }
        return { learned: true as const };
      });
    },
  };
}

import { randomUUID } from "node:crypto";
import type { LearnedStat } from "@/lib/engine";
import { displayName, normalizeName } from "@/lib/text";
import type { GuessSource } from "@/lib/types";
import {
  ANSWER_WINDOW_MS,
  type CreateGameInput,
  type GameStore,
  type SavedQuestion,
  type Statistics,
} from "./types";

type MemoryGame = CreateGameInput & {
  id: string;
  playedAt: Date;
  entityKey: string | null;
  userCorrectAnswer: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Pazartesi 00:00 UTC (Postgres `date_trunc('week')` ile aynı). */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** Süreç belleğinde çalışan depo. Sunucu yeniden başlayınca veri silinir. */
export function createMemoryStore(): GameStore {
  const rate = new Map<string, number>();
  const games: MemoryGame[] = [];
  const entities = new Map<string, string>();
  const stats = new Map<string, LearnedStat>();
  const questions: { id: string; text: string; approved: boolean; createdAt: Date }[] = [];

  const learn = (name: string, saved: SavedQuestion[]) => {
    const key = normalizeName(name);
    const created = !entities.has(key);
    if (created) entities.set(key, displayName(name));
    for (const q of saved) {
      const id = `${key}\u0000${q.questionId}`;
      const row = stats.get(id) ?? {
        name: entities.get(key)!,
        questionId: q.questionId,
        yes: 0,
        no: 0,
        unknown: 0,
      };
      if (q.answer === "evet") row.yes++;
      else if (q.answer === "hayır") row.no++;
      else row.unknown++;
      stats.set(id, row);
    }
    return { key, created };
  };

  return {
    persistent: false,

    async hitRateLimit(ipHash, windowStart) {
      const key = `${ipHash}:${windowStart.getTime()}`;
      const count = (rate.get(key) ?? 0) + 1;
      rate.set(key, count);
      return count;
    },

    async loadLearned() {
      const perEntity = new Map<string, number>();
      for (const g of games) {
        if (g.entityKey) perEntity.set(g.entityKey, (perEntity.get(g.entityKey) ?? 0) + 1);
      }
      return {
        games: games.length,
        stats: [...stats.values()].map((s) => ({
          ...s,
          entityGames: perEntity.get(normalizeName(s.name)) ?? 0,
        })),
        questions: questions.filter((q) => q.approved).map(({ id, text }) => ({ id, text })),
      };
    },

    async createGame(input) {
      const id = randomUUID();
      const entityKey = input.correct ? learn(input.prediction, input.questions).key : null;
      games.push({ ...input, id, playedAt: new Date(), entityKey, userCorrectAnswer: null });
      return { id };
    },

    async recordAnswer({ gameId, answer, now }) {
      const game = games.find((g) => g.id === gameId);
      if (!game) return { status: "not_found" };
      const expired = now.getTime() - game.playedAt.getTime() > ANSWER_WINDOW_MS;
      if (game.correct || game.userCorrectAnswer !== null || expired) return { status: "locked" };
      const { key, created } = learn(answer, game.questions);
      game.userCorrectAnswer = displayName(answer);
      game.entityKey = key;
      return { status: "ok", prediction: game.prediction, entityCreated: created };
    },

    async addSuggestedQuestion(question) {
      if (!questions.some((q) => q.id === question.id)) {
        questions.push({ ...question, approved: false, createdAt: new Date() });
      }
    },

    async listPendingQuestions() {
      return questions
        .filter((q) => !q.approved)
        .map(({ id, text, createdAt }) => ({ id, text, createdAt }));
    },

    async reviewQuestion(id, approve) {
      const index = questions.findIndex((q) => q.id === id && !q.approved);
      if (index < 0) return false;
      if (approve) questions[index].approved = true;
      else questions.splice(index, 1);
      return true;
    },

    async getStatistics(now): Promise<Statistics> {
      const sources: GuessSource[] = ["tree", "model", "gemini"];
      const bySource = sources
        .map((source) => {
          const list = games.filter((g) => g.source === source);
          return { source, total: list.length, correct: list.filter((g) => g.correct).length };
        })
        .filter((s) => s.total > 0);

      const top = new Map<string, number>();
      for (const g of games) {
        if (g.correct && g.entityKey) top.set(g.entityKey, (top.get(g.entityKey) ?? 0) + 1);
      }

      const since = weekStart(now).getTime() - 11 * WEEK_MS;
      const weeks = new Map<number, { total: number; correct: number }>();
      for (const g of games) {
        const w = weekStart(g.playedAt).getTime();
        if (w < since) continue;
        const row = weeks.get(w) ?? { total: 0, correct: 0 };
        row.total++;
        if (g.correct) row.correct++;
        weeks.set(w, row);
      }

      return {
        totalGames: games.length,
        correctGames: games.filter((g) => g.correct).length,
        bySource,
        topEntities: [...top]
          .map(([key, correct]) => ({ name: entities.get(key) ?? key, correct }))
          .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name, "tr"))
          .slice(0, 8),
        weekly: [...weeks]
          .sort(([a], [b]) => a - b)
          .map(([w, v]) => ({ weekStart: new Date(w).toISOString(), ...v })),
        learnedEntities: entities.size,
        pendingQuestions: questions.filter((q) => !q.approved).length,
      };
    },
  };
}

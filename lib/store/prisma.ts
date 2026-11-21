import type { PrismaClient } from "@/generated/prisma/client";
import type { Answer as DbAnswer } from "@/generated/prisma/enums";
import { displayName, normalizeName } from "@/lib/text";
import type { Answer } from "@/lib/types";
import { ANSWER_WINDOW_MS, type GameStore, type SavedQuestion, type Statistics } from "./types";

const toDb: Record<Answer, DbAnswer> = { evet: "evet", hayır: "hayir", bilmiyorum: "bilmiyorum" };

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Varlığı bulur ya da kurar, soru-cevap sayaçlarını tek sorguda artırır.
 * Soru satırı yoksa (ağaç sorusu) önce eklenir; FK bütünlüğü korunur.
 */
async function learn(tx: Tx, name: string, questions: SavedQuestion[]) {
  const nameNormalized = normalizeName(name);
  const existing = await tx.entity.findUnique({ where: { nameNormalized }, select: { id: true } });
  const entity =
    existing ??
    (await tx.entity.create({
      data: { name: displayName(name), nameNormalized },
      select: { id: true },
    }));

  if (questions.length > 0) {
    await tx.question.createMany({
      data: questions.map((q) => ({
        id: q.questionId,
        text: q.question,
        source: "tree" as const,
        approved: true,
      })),
      skipDuplicates: true,
    });
    const ids = questions.map((q) => q.questionId);
    const yes = questions.map((q) => (q.answer === "evet" ? 1 : 0));
    const no = questions.map((q) => (q.answer === "hayır" ? 1 : 0));
    const unknown = questions.map((q) => (q.answer === "bilmiyorum" ? 1 : 0));
    await tx.$executeRaw`
      INSERT INTO "EntityAnswerStat" ("entityId", "questionId", "yes", "no", "unknown")
      SELECT ${entity.id}, t.q, t.y, t.n, t.u
      FROM unnest(${ids}::text[], ${yes}::int[], ${no}::int[], ${unknown}::int[]) AS t(q, y, n, u)
      ON CONFLICT ("entityId", "questionId") DO UPDATE SET
        "yes" = "EntityAnswerStat"."yes" + EXCLUDED."yes",
        "no" = "EntityAnswerStat"."no" + EXCLUDED."no",
        "unknown" = "EntityAnswerStat"."unknown" + EXCLUDED."unknown"`;
  }
  return { entityId: entity.id, created: !existing };
}

export function createPrismaStore(prisma: PrismaClient): GameStore {
  return {
    persistent: true,

    async hitRateLimit(ipHash, windowStart) {
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("ipHash", "windowStart", "count")
        VALUES (${ipHash}, ${windowStart}, 1)
        ON CONFLICT ("ipHash", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
        RETURNING "count"`;
      // Eski pencereleri ara sıra temizle; her istekte silme yükü olmasın.
      if (Math.random() < 0.02) {
        const cutoff = new Date(windowStart.getTime() - 60 * 60 * 1000);
        await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
      }
      return rows[0]?.count ?? 1;
    },

    async loadLearned() {
      const [games, stats, questions] = await Promise.all([
        prisma.game.count(),
        prisma.entityAnswerStat.findMany({
          select: {
            questionId: true,
            yes: true,
            no: true,
            unknown: true,
            entity: { select: { name: true, _count: { select: { games: true } } } },
          },
        }),
        prisma.question.findMany({
          where: { approved: true, source: "gemini" },
          select: { id: true, text: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      return {
        games,
        stats: stats.map((s) => ({
          name: s.entity.name,
          questionId: s.questionId,
          yes: s.yes,
          no: s.no,
          unknown: s.unknown,
          entityGames: s.entity._count.games,
        })),
        questions,
      };
    },

    async createGame(input) {
      return prisma.$transaction(async (tx) => {
        const entityId = input.correct
          ? (await learn(tx, input.prediction, input.questions)).entityId
          : null;
        const game = await tx.game.create({
          data: {
            mode: input.mode,
            prediction: input.prediction,
            source: input.source,
            isPredictionCorrect: input.correct,
            entityId,
            gameQuestions: {
              create: input.questions.map((q, i) => ({
                questionId: q.questionId,
                question: q.question,
                answer: toDb[q.answer],
                questionIndex: i,
              })),
            },
          },
          select: { id: true },
        });
        return { id: game.id };
      });
    },

    async recordAnswer({ gameId, answer, now }) {
      return prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({
          where: { id: gameId },
          select: {
            prediction: true,
            playedAt: true,
            isPredictionCorrect: true,
            userCorrectAnswer: true,
            gameQuestions: {
              orderBy: { questionIndex: "asc" },
              select: { questionId: true, question: true, answer: true },
            },
          },
        });
        if (!game) return { status: "not_found" as const };
        const expired = now.getTime() - game.playedAt.getTime() > ANSWER_WINDOW_MS;
        if (game.isPredictionCorrect || game.userCorrectAnswer !== null || expired) {
          return { status: "locked" as const };
        }
        const questions: SavedQuestion[] = game.gameQuestions.map((q) => ({
          questionId: q.questionId,
          question: q.question,
          answer: q.answer === "hayir" ? "hayır" : q.answer,
        }));
        const { entityId, created } = await learn(tx, answer, questions);
        await tx.game.update({
          where: { id: gameId },
          data: { userCorrectAnswer: displayName(answer), entityId },
        });
        return { status: "ok" as const, prediction: game.prediction, entityCreated: created };
      });
    },

    async addSuggestedQuestion(question) {
      await prisma.question.createMany({
        data: [{ ...question, source: "gemini", approved: false }],
        skipDuplicates: true,
      });
    },

    async listPendingQuestions() {
      return prisma.question.findMany({
        where: { approved: false },
        select: { id: true, text: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
    },

    async reviewQuestion(id, approve) {
      const where = { id, approved: false };
      const { count } = approve
        ? await prisma.question.updateMany({ where, data: { approved: true } })
        : await prisma.question.deleteMany({ where });
      return count > 0;
    },

    async getStatistics(now): Promise<Statistics> {
      const since = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
      const [bySource, weekly, topEntities, learnedEntities, pendingQuestions] = await Promise.all([
        prisma.$queryRaw<
          { source: Statistics["bySource"][number]["source"]; total: number; correct: number }[]
        >`
          SELECT "source"::text AS source,
                 count(*)::int AS total,
                 count(*) FILTER (WHERE "isPredictionCorrect")::int AS correct
          FROM "Game" GROUP BY "source" ORDER BY total DESC`,
        prisma.$queryRaw<{ week: Date; total: number; correct: number }[]>`
          SELECT date_trunc('week', "playedAt") AS week,
                 count(*)::int AS total,
                 count(*) FILTER (WHERE "isPredictionCorrect")::int AS correct
          FROM "Game" WHERE "playedAt" >= ${since}
          GROUP BY 1 ORDER BY 1`,
        prisma.$queryRaw<{ name: string; correct: number }[]>`
          SELECT e."name" AS name, count(*)::int AS correct
          FROM "Game" g JOIN "Entity" e ON e."id" = g."entityId"
          WHERE g."isPredictionCorrect"
          GROUP BY e."name" ORDER BY correct DESC, e."name" LIMIT 8`,
        prisma.entity.count(),
        prisma.question.count({ where: { approved: false } }),
      ]);
      return {
        totalGames: bySource.reduce((a, s) => a + s.total, 0),
        correctGames: bySource.reduce((a, s) => a + s.correct, 0),
        bySource,
        topEntities,
        weekly: weekly.map((w) => ({
          weekStart: new Date(w.week).toISOString(),
          total: w.total,
          correct: w.correct,
        })),
        learnedEntities,
        pendingQuestions,
      };
    },
  };
}

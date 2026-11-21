import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createGameService } from "@/lib/game/service";
import { createPrismaStore } from "@/lib/store/prisma";
import { guessPaths, loadTree } from "@/lib/tree";
import type { ActionResult, GuessStep } from "@/lib/types";

// Gerçek Postgres'e karşı Prisma deposu. Önce `npx prisma migrate deploy` çalışmalı.
// CI bu testi postgres:17 servisiyle koşar; yerelde TEST_DATABASE_URL yoksa atlanır.
// Neon adapter'ı WebSocket ister; yerel Postgres için pg adapter'ı kullanılır.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Prisma deposu (Postgres)", () => {
  const tree = loadTree();
  const kurt = guessPaths(tree).find((p) => p.name === "Kurt")!;
  let prisma: PrismaClient;

  const data = <T>(r: ActionResult<T>): T => {
    if (!r.ok) throw new Error(`Beklenmeyen hata: ${r.error}`);
    return r.data;
  };

  const service = (now = () => new Date()) =>
    createGameService({
      tree,
      store: createPrismaStore(prisma),
      guesser: null,
      env: {
        RATE_LIMIT_PER_MINUTE: 3,
        ENGINE_MIN_GAMES: 25,
        ENTITY_MIN_GAMES: 2,
        IP_HASH_SALT: "entegrasyon-testi-tuzu",
      },
      now,
    });

  async function playKurt(s: ReturnType<typeof service>, ip: string, correct: boolean) {
    const g = data(await s.nextStep({ mode: "tree", steps: kurt.path }, ip)) as GuessStep;
    return data(
      await s.submitFeedback(
        {
          mode: "tree",
          steps: kurt.path,
          guess: g.answer,
          source: g.source,
          correct,
          token: g.token,
        },
        ip,
      ),
    );
  }

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "GameQuestion", "Game", "EntityAnswerStat", "Entity", "Question", "RateLimit"`;
  });

  it("doğru tahmin oyunu, soruları ve sayaçları tek işlemde yazar", async () => {
    const { gameId } = await playKurt(service(), "ip-1", true);
    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { gameQuestions: true, entity: true },
    });
    expect(game.isPredictionCorrect).toBe(true);
    expect(game.entity?.name).toBe("Kurt");
    expect(game.gameQuestions).toHaveLength(kurt.path.length);

    // İkinci oyun aynı satırları upsert ile artırır (unnest + ON CONFLICT).
    await playKurt(service(), "ip-2", true);
    const stats = await prisma.entityAnswerStat.findMany({ where: { entityId: game.entityId! } });
    expect(stats).toHaveLength(kurt.path.length);
    const total = stats.reduce((sum, s) => sum + s.yes + s.no + s.unknown, 0);
    expect(total).toBe(kurt.path.length * 2);

    const learned = await createPrismaStore(prisma).loadLearned();
    expect(learned.games).toBe(2);
    expect(learned.stats.every((s) => s.entityGames === 2)).toBe(true);
  });

  it("yanlış tahminde cevap sonradan eklenir; ikinci cevap ve geç cevap reddedilir", async () => {
    let now = new Date();
    const s = service(() => now);
    const { gameId } = await playKurt(s, "ip-3", false);
    expect(data(await s.submitAnswer({ gameId, answer: "çakal" }, "ip-3b"))).toEqual({
      learned: true,
    });
    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.userCorrectAnswer).toBe("Çakal");
    expect(await s.submitAnswer({ gameId, answer: "Tilki" }, "ip-3c")).toMatchObject({
      ok: false,
      error: "invalid",
    });

    const late = await playKurt(s, "ip-4", false);
    now = new Date(now.getTime() + 61 * 60 * 1000);
    expect(await s.submitAnswer({ gameId: late.gameId, answer: "Tilki" }, "ip-5")).toMatchObject({
      ok: false,
      error: "invalid",
    });
  });

  it("hız sınırı sayacı Postgres'te artar; ham IP saklanmaz", async () => {
    const s = service();
    for (let i = 0; i < 3; i++)
      expect((await s.nextStep({ steps: [] }, "198.51.100.4")).ok).toBe(true);
    expect(await s.nextStep({ steps: [] }, "198.51.100.4")).toMatchObject({
      ok: false,
      error: "rate_limited",
    });
    const rows = await prisma.rateLimit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(4);
    expect(rows[0].ipHash).not.toContain("198.51.100.4");
  });

  it("istatistik sorguları çalışır", async () => {
    await playKurt(service(), "ip-6", true);
    await playKurt(service(), "ip-7", false);
    const stats = await createPrismaStore(prisma).getStatistics(new Date());
    expect(stats.totalGames).toBe(2);
    expect(stats.correctGames).toBe(1);
    expect(stats.topEntities).toEqual([{ name: "Kurt", correct: 1 }]);
    expect(stats.weekly.reduce((a, w) => a + w.total, 0)).toBe(2);
  });
});

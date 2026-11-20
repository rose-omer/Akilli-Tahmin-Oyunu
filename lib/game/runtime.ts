import { getEnv } from "@/lib/env";
import { createGeminiGuesser } from "@/lib/gemini";
import { getPrisma } from "@/lib/prisma";
import { createMemoryStore } from "@/lib/store/memory";
import { createPrismaStore } from "@/lib/store/prisma";
import type { GameStore } from "@/lib/store/types";
import { getTree } from "@/lib/tree";
import { createGameService, type GameService } from "./service";

const globalForGame = globalThis as unknown as {
  gameStore?: GameStore;
  gameService?: Promise<GameService>;
};

/** DATABASE_URL varsa Neon; yoksa süreç belleği (yerel deneme için). */
export function getStore(): GameStore {
  if (!globalForGame.gameStore) {
    const env = getEnv();
    globalForGame.gameStore = env.DATABASE_URL
      ? createPrismaStore(getPrisma(env.DATABASE_URL))
      : createMemoryStore();
  }
  return globalForGame.gameStore;
}

export function getGameService(): Promise<GameService> {
  globalForGame.gameService ??= (async () => {
    const env = getEnv();
    return createGameService({
      tree: getTree(),
      store: getStore(),
      guesser: await createGeminiGuesser(env),
      env,
    });
  })();
  return globalForGame.gameService;
}

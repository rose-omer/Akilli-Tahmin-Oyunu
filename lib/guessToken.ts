import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { GuessSource, Mode, Step } from "@/lib/types";

/** Tahmin jetonu bu süre içinde geri bildirimde kullanılabilir. */
export const GUESS_TOKEN_TTL_MS = 60 * 60 * 1000;

export type GuessClaim = { mode: Mode; steps: Step[]; answer: string; source: GuessSource };

/**
 * Sunucunun ürettiği tahmini imzalar. Geri bildirim yalnız bu jetonla kabul edilir;
 * istemci uydurma bir adı "doğru" diye kaydedemez.
 * Sır yoksa (yerel deneme) süreç başına rastgele anahtar kullanılır.
 */
export function createGuessSigner(secret?: string) {
  // IP tuzu ile aynı sırdan ayrı bir anahtar türetilir (alan ayrımı).
  const key = secret
    ? createHmac("sha256", secret).update("tahmin-jetonu/v1").digest()
    : randomBytes(32);

  const mac = (claim: GuessClaim, issuedAt: number) =>
    createHmac("sha256", key)
      .update(
        JSON.stringify([
          issuedAt,
          claim.mode,
          claim.steps.map((s) => [s.q, s.a]),
          claim.answer,
          claim.source,
        ]),
      )
      .digest("base64url");

  return {
    sign(claim: GuessClaim, now: Date): string {
      const issuedAt = now.getTime();
      return `${issuedAt}.${mac(claim, issuedAt)}`;
    },

    verify(claim: GuessClaim, token: string, now: Date): boolean {
      const [rawIssuedAt, given] = token.split(".");
      const issuedAt = Number(rawIssuedAt);
      if (!Number.isSafeInteger(issuedAt) || !given) return false;
      const age = now.getTime() - issuedAt;
      if (age < 0 || age > GUESS_TOKEN_TTL_MS) return false;
      const expected = Buffer.from(mac(claim, issuedAt));
      const actual = Buffer.from(given);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}

import { createHash } from "node:crypto";
import type { GameStore } from "@/lib/store/types";

export const WINDOW_MS = 60_000;

/** Ham IP saklanmaz; tuzlu SHA-256 özeti tutulur. */
export function hashIp(ip: string, salt = ""): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Sabit pencere: dakikada `limit` istek. Sınır aşılırsa false. */
export async function allowRequest(input: {
  store: GameStore;
  ip: string;
  salt?: string;
  limit: number;
  now: Date;
}): Promise<boolean> {
  const windowStart = new Date(Math.floor(input.now.getTime() / WINDOW_MS) * WINDOW_MS);
  const count = await input.store.hitRateLimit(hashIp(input.ip, input.salt), windowStart);
  return count <= input.limit;
}

/**
 * Hız sınırı için istemci IP'si.
 * - Vercel: platform `x-vercel-forwarded-for` ve `x-real-ip` başlıklarını kendisi yazar.
 * - Diğer: X-Forwarded-For'un baştaki öğelerini istemci uydurabilir. Güvenilir proxy'lerin
 *   eklediği son `trustedHops` öğeden en soldakini al. Proxy yoksa başlık güvenilmez.
 */
export function clientIpFrom(
  headers: { get(name: string): string | null },
  options: { onVercel: boolean; trustedHops: number },
): string {
  const list = (name: string) =>
    (headers.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  if (options.onVercel) {
    return list("x-vercel-forwarded-for")[0] ?? list("x-real-ip")[0] ?? "unknown";
  }
  const chain = list("x-forwarded-for");
  const index = chain.length - Math.max(1, options.trustedHops);
  return chain[Math.max(0, index)] ?? list("x-real-ip")[0] ?? "unknown";
}

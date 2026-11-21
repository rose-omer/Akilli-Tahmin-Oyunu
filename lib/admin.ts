import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "yonetim_oturumu";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const sameBytes = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const sha = (s: string) => createHash("sha256").update(s).digest();

/** Parola karşılaştırması sabit sürede yapılır; uzunluk farkı da sızmaz. */
export function checkAdminPassword(given: string, expected: string): boolean {
  return sameBytes(sha(given), sha(expected));
}

/**
 * Oturum çerezi: parolanın kendisi değil, ondan türetilen HMAC.
 * Parola değişince bütün oturumlar geçersiz olur.
 */
export function adminSessionValue(adminToken: string): string {
  return createHmac("sha256", adminToken).update("yonetim-oturumu/v1").digest("base64url");
}

export function isAdminSession(cookie: string | undefined, adminToken: string): boolean {
  if (!cookie) return false;
  return sameBytes(Buffer.from(cookie), Buffer.from(adminSessionValue(adminToken)));
}

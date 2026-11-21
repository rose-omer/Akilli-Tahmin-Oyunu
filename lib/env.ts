import { z } from "zod";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z
  .object({
    /** Neon pooler adresi. Yoksa oyun bellekte çalışır, kalıcı kayıt olmaz. */
    DATABASE_URL: optionalString.pipe(z.url().optional()),
    /** Yoksa Gemini devre dışı; tahminleri ağaç ve motor yapar. */
    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: optionalString.transform((v) => v ?? DEFAULT_GEMINI_MODEL),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
    ENGINE_MIN_GAMES: z.coerce.number().int().nonnegative().default(25),
    /** Ağaçta olmayan yeni varlık, bu kadar oyunda geçmeden motoru etkilemez. */
    ENTITY_MIN_GAMES: z.coerce.number().int().positive().default(2),
    /** IP özetinin tuzu ve tahmin jetonu anahtarının kaynağı. Kalıcı ortamda zorunlu. */
    IP_HASH_SALT: optionalString,
    /** Vercel platformu "1" yazar; o zaman IP platform başlığından okunur. */
    VERCEL: optionalString,
    /** Vercel dışında: X-Forwarded-For'a adres ekleyen güvenilir proxy sayısı. */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
    /** /yonetim onay kuyruğunun parolası. Boşsa sayfa kapalı (404). */
    ADMIN_TOKEN: optionalString.pipe(z.string().min(16).optional()),
  })
  .superRefine((env, ctx) => {
    // Veritabanı varsa IP özeti saklanır; Vercel'de birden çok örnek aynı jeton anahtarını
    // paylaşmalı. İki durumda da tuz zorunlu ve tahmin edilemez olmalı.
    const required = env.DATABASE_URL !== undefined || env.VERCEL === "1";
    if (required && (env.IP_HASH_SALT?.length ?? 0) < 16) {
      ctx.addIssue({
        code: "custom",
        path: ["IP_HASH_SALT"],
        message: "Kalıcı ortamda IP_HASH_SALT en az 16 karakter olmalı.",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Ortam değişkenlerini ilk kullanımda doğrular; geçersiz değerde açık hata verir. */
export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  if (source !== process.env) return EnvSchema.parse(source);
  cached ??= EnvSchema.parse(source);
  return cached;
}

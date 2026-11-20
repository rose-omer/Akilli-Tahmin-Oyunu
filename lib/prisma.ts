import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Süreç başına tek Prisma örneği. Geliştirmede sıcak yenileme modülü yeniden yükler;
 * örnek `globalThis` üzerinde durduğu için yeni bağlantı havuzu açılmaz.
 * Neon pooler adresi (DATABASE_URL) kullanılır.
 */
export function getPrisma(connectionString: string): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  return globalForPrisma.prisma;
}

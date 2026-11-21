import "dotenv/config";
import { defineConfig } from "prisma/config";

// CLI (migrate) doğrudan bağlantı ister: Neon'da pooler olmayan adres.
// `prisma generate` adres istemez; değişken yoksa boş kalır.
// SHADOW_DATABASE_URL yalnız `npm run db:diff` (şema sapması denetimi) için gerekir.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;

// Önce `npm run build`. Sunucu veritabanısız (bellek deposu) ve Gemini'siz açılır.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Yerelde kurulu Chrome'u kullanmak için: PW_CHANNEL=chrome
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    { name: "masaüstü", use: { ...devices["Desktop Chrome"] } },
    { name: "mobil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: "",
      GEMINI_API_KEY: "",
      RATE_LIMIT_PER_MINUTE: "10000",
      // Yalnız yerel test sunucusu için; e2e/game.spec.ts aynı değeri kullanır.
      ADMIN_TOKEN: "e2e-yonetim-parolasi",
    },
  },
});

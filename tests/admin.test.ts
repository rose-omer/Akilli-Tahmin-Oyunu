import { describe, expect, it } from "vitest";
import { adminSessionValue, checkAdminPassword, isAdminSession } from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { createMemoryStore } from "@/lib/store/memory";

describe("soru onay kuyruğu", () => {
  it("onaylanan soru havuza girer; reddedilen silinir; ikinci karar etkisiz", async () => {
    const store = createMemoryStore();
    await store.addSuggestedQuestion({ id: "g_1", text: "Geceleri ulur mu?" });
    await store.addSuggestedQuestion({ id: "g_2", text: "Uygunsuz öneri" });
    expect((await store.listPendingQuestions()).map((q) => q.id)).toEqual(["g_1", "g_2"]);

    expect(await store.reviewQuestion("g_1", true)).toBe(true);
    expect(await store.reviewQuestion("g_2", false)).toBe(true);
    expect(await store.reviewQuestion("g_1", false)).toBe(false);
    expect(await store.reviewQuestion("yok", true)).toBe(false);

    expect(await store.listPendingQuestions()).toEqual([]);
    expect((await store.loadLearned()).questions).toEqual([
      { id: "g_1", text: "Geceleri ulur mu?" },
    ]);
  });
});

describe("yönetim oturumu", () => {
  const token = "yonetim-parolasi-uzun";

  it("parola sabit sürede ve tam eşleşmeyle denetlenir", () => {
    expect(checkAdminPassword(token, token)).toBe(true);
    expect(checkAdminPassword("yonetim", token)).toBe(false);
    expect(checkAdminPassword("", token)).toBe(false);
  });

  it("çerez parolanın kendisi değil; başka parolayla geçmez", () => {
    const value = adminSessionValue(token);
    expect(value).not.toContain(token);
    expect(isAdminSession(value, token)).toBe(true);
    expect(isAdminSession(value, "baska-parola-uzun-deger")).toBe(false);
    expect(isAdminSession(undefined, token)).toBe(false);
  });

  it("ADMIN_TOKEN boşsa kapalı; kısa parola reddedilir", () => {
    expect(getEnv({}).ADMIN_TOKEN).toBeUndefined();
    expect(() => getEnv({ ADMIN_TOKEN: "kisa" })).toThrow();
    expect(getEnv({ ADMIN_TOKEN: token }).ADMIN_TOKEN).toBe(token);
  });
});

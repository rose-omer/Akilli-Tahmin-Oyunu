import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { guessPaths, isGuess, loadTree } from "../lib/tree";

const tree = loadTree();
const textOf = (id: string) => {
  const node = tree.nodes.get(id);
  return node && !isGuess(node) ? node.text : "";
};
const aslan = guessPaths(tree).find((p) => p.name === "Aslan")!;
const answers = new Map(aslan.path.map((s) => [textOf(s.q), s.a]));

const question = (page: Page) => page.locator("h1#soru");
// playwright.config.ts sunucuya aynı değeri verir; yalnız test sunucusu içindir.
const ADMIN_TOKEN = "e2e-yonetim-parolasi";

async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Aslan yolunu klavyeyle oynar (E / H) ve tahmin ekranına varır. */
async function playToAslan(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Oyuna başla" }).click();
  await expect(question(page)).toHaveText(textOf(tree.root));
  await expect(page.getByRole("heading", { level: 2, name: "Şüpheliler" })).toBeVisible();
  for (let i = 0; i < aslan.path.length; i++) {
    await expect(page.getByText(`Soru ${i + 1} / 30`)).toBeVisible();
    await expect(page.getByText("Düşünüyorum…")).toBeHidden();
    const text = (await question(page).innerText()).trim();
    const a = answers.get(text);
    expect(a, `Beklenmeyen soru: ${text}`).toBeDefined();
    await page.keyboard.press(a === "evet" ? "e" : "h");
  }
  await expect(page.getByRole("heading", { name: /tahminim\s*Aslan/i })).toBeVisible();
}

test("başlangıç ekranı erişilebilir", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Aklından bir şey tut." }),
  ).toBeVisible();
  await axe(page);
});

test("klavyeyle tam oyun: ağaç tahmini doğru, oyun kaydedilir", async ({ page }) => {
  await playToAslan(page);
  await axe(page);
  await page.getByRole("button", { name: "Doğru bildin" }).click();
  await expect(page.getByRole("heading", { name: "Bildim: Aslan" })).toBeFocused();
  await expect(page.getByText(`${aslan.path.length} cevap Aslan için eklendi`)).toBeVisible();
});

test("yanlış tahmin: doğru cevap yazılır ve kaydedilir", async ({ page }) => {
  await playToAslan(page);
  await page.getByRole("button", { name: "Yanlış" }).click();
  await expect(page.getByRole("heading", { name: "Aklındaki neydi?" })).toBeFocused();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Cevabı yaz ya da adaylardan birini seç.")).toHaveAttribute(
    "role",
    "alert",
  );
  await page.getByRole("textbox", { name: /yaz|Cevabın/ }).fill("Kaplan");
  await axe(page);
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Kaydedildi" })).toBeVisible();
  await expect(page.getByText("cevap Kaplan için eklendi")).toBeVisible();
});

test("G son cevabı geri alır", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Oyuna başla" }).click();
  const first = textOf(tree.root);
  await expect(question(page)).toHaveText(first);
  await page.keyboard.press("e");
  await expect(page.getByText("Soru 2 / 30")).toBeVisible();
  await expect(page.getByText("Düşünüyorum…")).toBeHidden();
  await expect(question(page)).not.toHaveText(first);
  await axe(page);
  await page.keyboard.press("g");
  await expect(page.getByText("Soru 1 / 30")).toBeVisible();
  await expect(question(page)).toHaveText(first);
});

test("bağlantı hatasında hata kartı çıkar; tekrar dene oyunu sürdürür", async ({ page }) => {
  await page.goto("/");
  await page.route("**/*", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"]
      ? route.abort()
      : route.continue(),
  );
  await page.getByRole("button", { name: "Oyuna başla" }).click();
  await expect(page.getByRole("heading", { name: "Bağlantı kurulamadı" })).toBeFocused();
  await axe(page);
  await page.unrouteAll();
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByText("Soru 1 / 30")).toBeVisible();
  await expect(question(page)).toHaveText(textOf(tree.root));
});

test.describe("karanlık tema", () => {
  test.use({ colorScheme: "dark" });

  test("başlangıç ve soru ekranı kontrast denetiminden geçer", async ({ page }) => {
    await page.goto("/");
    await axe(page);
    await page.getByRole("button", { name: "Oyuna başla" }).click();
    await expect(question(page)).toHaveText(textOf(tree.root));
    await page.keyboard.press("e");
    await expect(page.getByText("Düşünüyorum…")).toBeHidden();
    await axe(page);
  });

  test("tahmin ekranı ve istatistik sayfası kontrast denetiminden geçer", async ({ page }) => {
    await playToAslan(page);
    await axe(page);
    await page.goto("/istatistik");
    await axe(page);
  });
});

test("yönetim: yanlış parola uyarı verir; doğru parolayla boş kuyruk görünür", async ({ page }) => {
  await page.goto("/yonetim");
  await expect(page.getByRole("heading", { level: 1, name: "Soru onayı" })).toBeVisible();
  await axe(page);
  const password = page.getByLabel("Parola");
  await password.fill("yanlis-parola");
  await password.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Parola yanlış." })).toBeVisible();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await password.fill(ADMIN_TOKEN);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Onay bekleyen soru yok" })).toBeVisible();
  await axe(page);
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL("/");
});

test("istatistik sayfası oyunları gösterir ve erişilebilir", async ({ page }) => {
  await page.goto("/istatistik");
  await expect(page.getByRole("heading", { level: 1, name: "İstatistikler" })).toBeVisible();
  await expect(page.getByText("Veritabanı bağlı değil")).toBeVisible();
  await axe(page);
});

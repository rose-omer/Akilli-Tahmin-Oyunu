import { describe, expect, it, vi } from "vitest";
import {
  buildGuessPrompt,
  createGuesser,
  GUESS_JSON_SCHEMA,
  parseGuessResponse,
  type GenerateFn,
} from "@/lib/gemini";
import { DEFAULT_GEMINI_MODEL, getEnv } from "@/lib/env";

const valid = JSON.stringify({ guess: "Kurt", alternatives: ["Tilki", "Köpek"], confidence: 0.7 });

describe("Gemini yanıt ayrıştırma", () => {
  it("şemaya uyan yanıtı kabul eder", () => {
    expect(parseGuessResponse(valid)).toEqual({
      guess: "Kurt",
      alternatives: ["Tilki", "Köpek"],
      confidence: 0.7,
    });
  });

  it.each([
    ["boş", undefined],
    ["JSON değil", "Kurt"],
    ["alan eksik", JSON.stringify({ guess: "Kurt" })],
    ["güven aralık dışı", JSON.stringify({ guess: "Kurt", alternatives: [], confidence: 3 })],
    [
      "fazla alternatif",
      JSON.stringify({ guess: "A", alternatives: ["B", "C", "D", "E"], confidence: 1 }),
    ],
  ])("şema dışı yanıtı reddeder: %s", (_, text) => {
    expect(() => parseGuessResponse(text)).toThrow();
  });
});

describe("istem", () => {
  it("yalnız sunucunun verdiği soru ve cevaplardan kurulur", () => {
    const prompt = buildGuessPrompt(
      [
        { question: "Bir hayvan mı?", answer: "evet" },
        { question: "Uçabilir mi?", answer: "hayır" },
      ],
      ["Kurt", "Tilki"],
    );
    expect(prompt).toBe(
      "Sorular ve cevaplar:\n1. Bir hayvan mı? — Evet\n2. Uçabilir mi? — Hayır\n\nMotorun adayları: Kurt, Tilki",
    );
  });
});

describe("createGuesser (sahte istemci)", () => {
  it("yapılandırılmış çıktı ister ve model adını iletir", async () => {
    const generate = vi.fn<GenerateFn>().mockResolvedValue({ text: valid });
    const guesser = createGuesser({ generate, model: "test-model" });
    const result = await guesser.guess({
      qa: [{ question: "Hayvan mı?", answer: "evet" }],
      candidates: [],
    });
    expect(result.guess).toBe("Kurt");
    const request = generate.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.config).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: GUESS_JSON_SCHEMA,
      thinkingConfig: { thinkingLevel: "LOW" },
      maxOutputTokens: 256,
    });
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("429 ve 5xx hatasında bir kez yeniden dener", async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockRejectedValueOnce(Object.assign(new Error("yoğun"), { status: 503 }))
      .mockResolvedValue({ text: valid });
    await createGuesser({ generate, model: "m" }).guess({ qa: [], candidates: [] });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("400 hatasında yeniden denemez", async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockRejectedValue(Object.assign(new Error("kötü istek"), { status: 400 }));
    await expect(
      createGuesser({ generate, model: "m" }).guess({ qa: [], candidates: [] }),
    ).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("soru önerisi soru işaretiyle biter", async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockResolvedValue({ text: JSON.stringify({ question: "Ulumaz mı" }) });
    await expect(
      createGuesser({ generate, model: "m" }).suggestQuestion({
        entity: "Çakal",
        confusedWith: "Kurt",
      }),
    ).rejects.toThrow();
  });
});

describe("ortam", () => {
  it("model adı varsayılan olarak planın önerdiği model", () => {
    expect(getEnv({}).GEMINI_MODEL).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(getEnv({ GEMINI_MODEL: "baska-model" }).GEMINI_MODEL).toBe("baska-model");
  });

  it("boş anahtar Gemini'yi kapatır", () => {
    expect(getEnv({ GEMINI_API_KEY: "  " }).GEMINI_API_KEY).toBeUndefined();
  });

  it("geçersiz değer açık hata verir", () => {
    expect(() => getEnv({ RATE_LIMIT_PER_MINUTE: "sıfır" })).toThrow();
  });

  it("veritabanı ya da Vercel varsa IP_HASH_SALT zorunlu (en az 16 karakter)", () => {
    const db = "postgresql://k:p@localhost:5432/tahmin";
    expect(() => getEnv({ DATABASE_URL: db })).toThrow(/IP_HASH_SALT/);
    expect(() => getEnv({ VERCEL: "1" })).toThrow(/IP_HASH_SALT/);
    expect(() => getEnv({ DATABASE_URL: db, IP_HASH_SALT: "kisa" })).toThrow(/IP_HASH_SALT/);
    expect(getEnv({ DATABASE_URL: db, IP_HASH_SALT: "x".repeat(32) }).IP_HASH_SALT).toHaveLength(
      32,
    );
    expect(getEnv({}).IP_HASH_SALT).toBeUndefined();
  });
});

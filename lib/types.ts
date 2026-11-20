export const MAX_QUESTIONS = 30;

export const ANSWERS = ["evet", "hayır", "bilmiyorum"] as const;
export type Answer = (typeof ANSWERS)[number];

/** Bir soru ve kullanıcının cevabı. İstemci yalnız soru kimliğini taşır, metni değil. */
export type Step = { q: string; a: Answer };

/** tree: oyun soru ağacıyla başlar; engine: öğrenen motor baştan yönetir. */
export type Mode = "tree" | "engine";

/** tree: ağaç yaprağı; model: öğrenen motor; gemini: Gemini tahmini. */
export type GuessSource = "tree" | "model" | "gemini";

export type QuestionStep = {
  kind: "question";
  mode: Mode;
  questionId: string;
  text: string;
  /** Şu ana kadarki cevaplara en çok uyan adaylar (en çok 4); "Şüpheliler" paneli. */
  candidates: string[];
};

export type GuessStep = {
  kind: "guess";
  mode: Mode;
  answer: string;
  source: GuessSource;
  /** 0–1; ağaç tahmininde bilinmez (null). */
  confidence: number | null;
  alternatives: string[];
  /** Geri bildirimde aynen geri gönderilir; sunucu tahmini kendisinin ürettiğini doğrular. */
  token: string;
};

export type NextStepResult = QuestionStep | GuessStep;

export type ActionError = "invalid" | "rate_limited" | "server";

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError; requestId: string };

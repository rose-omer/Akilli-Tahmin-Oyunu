import { z } from "zod";
import { ANSWERS, MAX_QUESTIONS } from "@/lib/types";

/** İstemci soru metni değil, yalnız kimliği gönderir. Serbest metin bu kalıba uymaz. */
export const QuestionIdSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);

export const StepSchema = z.object({ q: QuestionIdSchema, a: z.enum(ANSWERS) }).strict();

export const ModeSchema = z.enum(["tree", "engine"]);

const StepsSchema = z
  .array(StepSchema)
  .max(MAX_QUESTIONS)
  .refine((steps) => new Set(steps.map((s) => s.q)).size === steps.length, {
    message: "Aynı soru iki kez cevaplanamaz.",
  });

/** Harf ya da rakamla başlar; harf, rakam, boşluk, kesme, tire ve nokta içerir. */
export const EntityNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*$/u);

export const NextStepInputSchema = z
  .object({ mode: ModeSchema.optional(), steps: StepsSchema })
  .strict();

export const FeedbackInputSchema = z
  .object({
    mode: ModeSchema,
    steps: StepsSchema.refine((s) => s.length > 0),
    guess: EntityNameSchema,
    source: z.enum(["tree", "model", "gemini"]),
    correct: z.boolean(),
    /** nextStep'in tahminle birlikte verdiği imzalı jeton: `<zaman>.<HMAC>` */
    token: z.string().regex(/^\d{1,15}\.[A-Za-z0-9_-]{43}$/),
  })
  .strict();

export const AnswerInputSchema = z.object({ gameId: z.uuid(), answer: EntityNameSchema }).strict();

export type NextStepInput = z.infer<typeof NextStepInputSchema>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

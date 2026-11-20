import type { LearnedStat } from "@/lib/engine";
import type { Answer, GuessSource, Mode } from "@/lib/types";

export type SavedQuestion = { questionId: string; question: string; answer: Answer };

export type CreateGameInput = {
  mode: Mode;
  prediction: string;
  source: GuessSource;
  correct: boolean;
  questions: SavedQuestion[];
};

export type RecordAnswerResult =
  { status: "ok"; prediction: string; entityCreated: boolean } | { status: "not_found" | "locked" };

export type Statistics = {
  totalGames: number;
  correctGames: number;
  bySource: { source: GuessSource; total: number; correct: number }[];
  topEntities: { name: string; correct: number }[];
  /** Son 12 hafta; haftanın başlangıcı ISO tarih. */
  weekly: { weekStart: string; total: number; correct: number }[];
  learnedEntities: number;
  pendingQuestions: number;
};

export type PendingQuestion = { id: string; text: string; createdAt: Date };

export type Learned = {
  games: number;
  /** entityGames: varlığın doğru cevap olduğu oyun sayısı (güven eşiği için). */
  stats: (LearnedStat & { entityGames: number })[];
  /** Onaylı, Gemini kaynaklı ek sorular. */
  questions: { id: string; text: string }[];
};

/** Veri erişimi. Üretimde Prisma + Neon; veritabanı yoksa ve testlerde bellek. */
export interface GameStore {
  readonly persistent: boolean;
  /** Pencere sayacını bir artırır, yeni değeri döner. */
  hitRateLimit(ipHash: string, windowStart: Date): Promise<number>;
  loadLearned(): Promise<Learned>;
  /** Oyunu kaydeder; tahmin doğruysa aynı işlemde motor sayaçlarını artırır. */
  createGame(input: CreateGameInput): Promise<{ id: string }>;
  /** Yanlış tahmin edilen oyuna doğru cevabı ekler ve motor sayaçlarını artırır. */
  recordAnswer(input: { gameId: string; answer: string; now: Date }): Promise<RecordAnswerResult>;
  addSuggestedQuestion(question: { id: string; text: string }): Promise<void>;
  /** Onay bekleyen Gemini soruları, eskiden yeniye. */
  listPendingQuestions(): Promise<PendingQuestion[]>;
  /** Onay: soru havuza girer. Ret: soru silinir. Bekleyen soru yoksa false. */
  reviewQuestion(id: string, approve: boolean): Promise<boolean>;
  getStatistics(now: Date): Promise<Statistics>;
}

/** Yanlış tahminden sonra cevap bu süre içinde eklenebilir. */
export const ANSWER_WINDOW_MS = 60 * 60 * 1000;

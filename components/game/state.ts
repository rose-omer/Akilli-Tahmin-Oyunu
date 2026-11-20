import type { ActionError, Answer, GuessStep, Mode, NextStepResult } from "@/lib/types";

export type HistoryItem = { questionId: string; text: string; answer: Answer };

export type Phase = "start" | "question" | "guess" | "wrong" | "done";

/** Hata kartındaki "Tekrar dene" bu isteği yeniden gönderir. */
export type Retry =
  { type: "next" } | { type: "feedback"; correct: boolean } | { type: "answer"; answer: string };

export type GameError = { kind: ActionError | "network"; requestId?: string; retry: Retry };

export type Outcome =
  { kind: "correct"; name: string } | { kind: "learned"; name: string } | { kind: "skipped" };

export type State = {
  phase: Phase;
  mode?: Mode;
  history: HistoryItem[];
  question: { id: string; text: string } | null;
  guess: GuessStep | null;
  gameId: string | null;
  outcome: Outcome | null;
  pending: Retry["type"] | null;
  error: GameError | null;
};

export const initialState: State = {
  phase: "start",
  history: [],
  question: null,
  guess: null,
  gameId: null,
  outcome: null,
  pending: null,
  error: null,
};

export type Action =
  | { type: "start" }
  | { type: "answer"; answer: Answer }
  | { type: "pending"; pending: Retry["type"] }
  | { type: "next"; result: NextStepResult }
  | { type: "undo" }
  | { type: "feedback-saved"; correct: boolean; gameId: string }
  | { type: "answer-saved"; name: string }
  | { type: "skip" }
  | { type: "error"; error: GameError }
  | { type: "reset" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...initialState, phase: "question", pending: "next" };
    case "answer": {
      if (!state.question) return state;
      const item = {
        questionId: state.question.id,
        text: state.question.text,
        answer: action.answer,
      };
      return { ...state, history: [...state.history, item], pending: "next", error: null };
    }
    case "pending":
      return { ...state, pending: action.pending, error: null };
    case "next": {
      const r = action.result;
      if (r.kind === "question") {
        return {
          ...state,
          mode: r.mode,
          phase: "question",
          question: { id: r.questionId, text: r.text },
          guess: null,
          pending: null,
        };
      }
      return { ...state, mode: r.mode, phase: "guess", guess: r, pending: null };
    }
    case "undo": {
      const last = state.history.at(-1);
      if (!last || state.pending) return state;
      return {
        ...state,
        phase: "question",
        history: state.history.slice(0, -1),
        question: { id: last.questionId, text: last.text },
        guess: null,
        error: null,
      };
    }
    case "feedback-saved":
      return action.correct
        ? {
            ...state,
            gameId: action.gameId,
            phase: "done",
            outcome: { kind: "correct", name: state.guess?.answer ?? "" },
            pending: null,
          }
        : { ...state, gameId: action.gameId, phase: "wrong", pending: null };
    case "answer-saved":
      return {
        ...state,
        phase: "done",
        outcome: { kind: "learned", name: action.name },
        pending: null,
      };
    case "skip":
      return { ...state, phase: "done", outcome: { kind: "skipped" }, pending: null, error: null };
    case "error":
      return { ...state, pending: null, error: action.error };
    case "reset":
      return initialState;
  }
}

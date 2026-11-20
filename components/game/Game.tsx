"use client";

import { useEffect, useReducer, useRef } from "react";
import { nextStep, submitAnswer, submitFeedback } from "@/app/actions";
import type { ActionResult, Answer } from "@/lib/types";
import { ErrorCard } from "./ErrorCard";
import {
  AnswerLog,
  DoneScreen,
  GuessScreen,
  HowItLearns,
  QuestionScreen,
  StartScreen,
  Suspects,
  WrongScreen,
} from "./screens";
import { initialState, reducer, type Retry, type State } from "./state";

const stepsOf = (s: State) => s.history.map((h) => ({ q: h.questionId, a: h.answer }));

/** Ağ hatasında (sunucuya ulaşılamadı) null döner. */
async function call<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

const KEYS: Record<string, Answer> = { e: "evet", h: "hayır", b: "bilmiyorum" };

export function Game() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Ekran değişince odağı yeni ekranın başlığına taşı (ilk açılışta değil).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const screenKey = state.error ? `hata-${state.error.kind}` : state.phase;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [screenKey]);

  /** İsteği gönderir. `s`: isteğin dayandığı durum (dispatch sonrası değer). */
  async function run(retry: Retry, s: State) {
    const fail = (r: ActionResult<unknown> | null) =>
      dispatch({
        type: "error",
        error:
          r && !r.ok
            ? { kind: r.error, requestId: r.requestId, retry }
            : { kind: "network", retry },
      });

    if (retry.type === "next") {
      dispatch({ type: "pending", pending: "next" });
      const r = await call(() => nextStep({ mode: s.mode, steps: stepsOf(s) }));
      return r?.ok ? dispatch({ type: "next", result: r.data }) : fail(r);
    }
    if (retry.type === "feedback") {
      const guess = s.guess;
      if (!guess || !s.mode) return;
      dispatch({ type: "pending", pending: "feedback" });
      const r = await call(() =>
        submitFeedback({
          mode: s.mode,
          steps: stepsOf(s),
          guess: guess.answer,
          source: guess.source,
          correct: retry.correct,
          token: guess.token,
        }),
      );
      return r?.ok
        ? dispatch({ type: "feedback-saved", correct: retry.correct, gameId: r.data.gameId })
        : fail(r);
    }
    const gameId = s.gameId;
    if (!gameId) return;
    dispatch({ type: "pending", pending: "answer" });
    const r = await call(() => submitAnswer({ gameId, answer: retry.answer }));
    return r?.ok ? dispatch({ type: "answer-saved", name: retry.answer.trim() }) : fail(r);
  }

  function start() {
    dispatch({ type: "start" });
    void run({ type: "next" }, reducer(initialState, { type: "start" }));
  }

  function answer(a: Answer) {
    if (state.phase !== "question" || state.pending || state.error || !state.question) return;
    const action = { type: "answer", answer: a } as const;
    dispatch(action);
    void run({ type: "next" }, reducer(state, action));
  }

  function undo() {
    dispatch({ type: "undo" });
  }

  // Klavye kısayolları: E evet, H hayır, B bilmiyorum, G geri al.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      if (state.phase !== "question" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLocaleLowerCase("tr-TR");
      if (KEYS[key]) {
        e.preventDefault();
        answer(KEYS[key]);
      } else if (key === "g") {
        e.preventDefault();
        undo();
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {renderScreen()}
      <aside aria-label="Oyun kaydı" className="grid min-w-0 gap-8">
        {state.phase === "start" && !state.error ? (
          <HowItLearns />
        ) : (
          <>
            <AnswerLog history={state.history} />
            {state.phase === "question" && !state.error && (
              <Suspects
                names={state.question?.candidates ?? []}
                note="Şu ana kadarki cevaplara en çok uyanlar."
              />
            )}
            {state.phase === "guess" && !state.error && (
              <Suspects
                names={state.guess?.alternatives ?? []}
                note="Bu daldan çıkabilecek diğer tahminler."
              />
            )}
          </>
        )}
      </aside>
    </div>
  );

  function renderScreen() {
    if (state.error) {
      return (
        <ErrorCard
          error={state.error}
          headingRef={headingRef}
          onRetry={() => void run(state.error!.retry, state)}
          onReset={() => dispatch({ type: "reset" })}
          onUndo={state.error.retry.type === "next" && state.history.length > 0 ? undo : undefined}
        />
      );
    }

    switch (state.phase) {
      case "start":
        return <StartScreen headingRef={headingRef} onStart={start} />;
      case "question":
        return (
          <QuestionScreen state={state} headingRef={headingRef} onAnswer={answer} onUndo={undo} />
        );
      case "guess":
        return (
          <GuessScreen
            state={state}
            headingRef={headingRef}
            onFeedback={(correct) => void run({ type: "feedback", correct }, state)}
            onUndo={undo}
          />
        );
      case "wrong":
        return (
          <WrongScreen
            state={state}
            headingRef={headingRef}
            onSubmit={(name) => void run({ type: "answer", answer: name }, state)}
            onSkip={() => dispatch({ type: "skip" })}
          />
        );
      case "done":
        return <DoneScreen state={state} headingRef={headingRef} onRestart={start} />;
    }
  }
}

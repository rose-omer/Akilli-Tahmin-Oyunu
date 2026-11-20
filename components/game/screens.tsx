import Link from "next/link";
import { useId, useState, type FormEvent, type RefObject } from "react";
import { EntityNameSchema } from "@/lib/schemas";
import { MAX_QUESTIONS, type Answer, type GuessSource } from "@/lib/types";
import type { HistoryItem, State } from "./state";
import { Button, Kbd } from "./ui";

type HeadingRef = RefObject<HTMLHeadingElement | null>;

const ANSWER_LABEL: Record<Answer, string> = {
  evet: "Evet",
  hayır: "Hayır",
  bilmiyorum: "Bilmiyorum",
};

const SOURCE_LABEL: Record<GuessSource, string> = {
  tree: "Soru ağacının yaprağından",
  model: "Öğrenen motorun en olası adayı",
  gemini: "Gemini, motorun adaylarına bakarak",
};

const headingFocus = "outline-none focus-visible:outline-none";

/* ───────────── Başlangıç ───────────── */

export function StartScreen({
  onStart,
  headingRef,
}: {
  onStart: () => void;
  headingRef: HeadingRef;
}) {
  return (
    <section
      aria-labelledby="baslik"
      className="flex flex-1 flex-col justify-center py-10 sm:py-16"
    >
      <h1
        id="baslik"
        ref={headingRef}
        tabIndex={-1}
        className={`max-w-[13ch] text-display font-bold tracking-[-0.035em] ${headingFocus}`}
      >
        Aklından bir şey tut.
      </h1>
      <p className="mt-5 max-w-[46ch] text-lg text-fg-muted">
        Bir hayvan, bir eşya, bir yer ya da bir duygu olabilir. Ben soru sorarım; sen evet, hayır ya
        da bilmiyorum dersin. En çok {MAX_QUESTIONS} soruda bulmaya çalışırım.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button variant="primary" onClick={onStart} className="px-7">
          Oyuna başla
        </Button>
        <p className="hidden text-sm text-fg-subtle sm:block">
          Klavyeyle de oynanır: <span className="text-fg-muted">E</span> evet,{" "}
          <span className="text-fg-muted">H</span> hayır, <span className="text-fg-muted">B</span>{" "}
          bilmiyorum.
        </p>
      </div>
      <HowItLearns />
    </section>
  );
}

function HowItLearns() {
  return (
    <details className="group mt-14 border-t border-line pt-2">
      <summary className="flex min-h-12 list-none items-center justify-between gap-4 rounded-md text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
        Nasıl öğreniyor?
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 text-fg-subtle transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="pb-2 text-fg-muted">
        <ol className="mt-2 max-w-[60ch] list-decimal space-y-3 pl-5 marker:text-fg-subtle">
          <li>
            Her varlık için soru başına üç sayaç tutarım: kaç kişi evet, hayır ya da bilmiyorum
            dedi. Soru ağacındaki yollar ilk bilgiyi verir.
          </li>
          <li>
            Her cevaptan sonra adayların olasılığını Bayes kuralıyla güncellerim. Hiç görülmemiş
            cevap sıfır sayılmasın diye sayaçlara bir eklerim (Laplace düzeltmesi).
          </li>
          <li>
            Sıradaki soru, adayları en iyi ayıran sorudur: beklenen bilgi kazancı en yüksek olan.
            <span className="mt-2 block text-sm text-fg-subtle">
              IG(q) = H(p) − Σ<sub>a</sub> P(a) · H(p | a)
            </span>
          </li>
          <li>
            Bir aday yüzde 60’ı geçince tahmin ederim. Adaylar zayıf kalırsa Gemini’ye cevaplarını
            ve ilk beş adayı gönderirim.
          </li>
          <li>
            Oyun bitince cevapların doğru varlığın sayaçlarına eklenir. Sonraki oyun bu veriyle
            başlar.
          </li>
        </ol>
      </div>
    </details>
  );
}

/* ───────────── Soru ───────────── */

const ANSWER_KEYS: { answer: Answer; key: string; variant: "secondary" | "ghost" }[] = [
  { answer: "evet", key: "E", variant: "secondary" },
  { answer: "hayır", key: "H", variant: "secondary" },
  { answer: "bilmiyorum", key: "B", variant: "ghost" },
];

export function QuestionScreen({
  state,
  headingRef,
  onAnswer,
  onUndo,
}: {
  state: State;
  headingRef: HeadingRef;
  onAnswer: (a: Answer) => void;
  onUndo: () => void;
}) {
  const busy = state.pending === "next";
  const asked = state.history.length;
  const number = Math.min(asked + 1, MAX_QUESTIONS);
  const progressId = useId();

  return (
    <section aria-labelledby="soru" aria-busy={busy} className="flex flex-1 flex-col pb-32 sm:pb-0">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <label htmlFor={progressId} className="text-sm text-fg-muted tabular-nums">
          Soru {number} / {MAX_QUESTIONS}
        </label>
        <Button
          variant="ghost"
          onClick={onUndo}
          busy={busy || asked === 0}
          aria-keyshortcuts="G"
          className="min-h-10 px-3 text-sm"
        >
          Geri al
          <Kbd>G</Kbd>
        </Button>
      </div>
      <progress id={progressId} className="progress mt-2" max={MAX_QUESTIONS} value={asked} />

      {/* Başlık hep yerinde kalır; odak ve canlı bölge soru değişiminde kaybolmaz. */}
      <div aria-live="polite" className="flex min-h-48 items-center py-10 sm:min-h-56 sm:py-14">
        <h2
          id="soru"
          ref={headingRef}
          tabIndex={-1}
          className={`w-full max-w-[28ch] text-question font-semibold tracking-[-0.02em] ${headingFocus}`}
        >
          {busy || !state.question ? (
            <span className="block">
              <span aria-hidden="true" className="skeleton block h-7 w-4/5" />
              <span aria-hidden="true" className="skeleton mt-3 block h-7 w-1/2" />
              <span className="mt-5 block text-sm font-normal tracking-normal text-fg-muted">
                Düşünüyorum…
              </span>
            </span>
          ) : (
            <span key={state.question.id} className="enter block">
              {state.question.text}
            </span>
          )}
        </h2>
      </div>

      <div
        role="group"
        aria-label="Cevabın"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
          {ANSWER_KEYS.map(({ answer, key, variant }) => (
            <Button
              key={answer}
              variant={variant}
              busy={busy}
              onClick={() => onAnswer(answer)}
              aria-keyshortcuts={key}
              className="min-h-14 px-3 sm:justify-between sm:px-5"
            >
              {ANSWER_LABEL[answer]}
              <Kbd>{key}</Kbd>
            </Button>
          ))}
        </div>
      </div>

      {asked > 0 && <AnswerTrail history={state.history} />}
    </section>
  );
}

function AnswerTrail({ history }: { history: HistoryItem[] }) {
  return (
    <section aria-labelledby="cevaplar" className="mt-10">
      <h3 id="cevaplar" className="text-sm font-medium text-fg-muted">
        Verdiğin cevaplar
      </h3>
      <ol reversed className="mt-2 divide-y divide-line border-y border-line">
        {history
          .map((item, i) => ({ item, n: i + 1 }))
          .reverse()
          .map(({ item, n }) => (
            <li key={item.questionId} className="flex items-baseline gap-3 py-2.5 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-fg-subtle tabular-nums">
                {n}
              </span>
              <span className="flex-1 text-fg-muted">{item.text}</span>
              <span
                className={
                  item.answer === "evet"
                    ? "font-medium text-accent"
                    : item.answer === "hayır"
                      ? "font-medium text-fg"
                      : "text-fg-subtle italic"
                }
              >
                {ANSWER_LABEL[item.answer]}
              </span>
            </li>
          ))}
      </ol>
    </section>
  );
}

/* ───────────── Tahmin ───────────── */

export function GuessScreen({
  state,
  headingRef,
  onFeedback,
  onUndo,
}: {
  state: State;
  headingRef: HeadingRef;
  onFeedback: (correct: boolean) => void;
  onUndo: () => void;
}) {
  const guess = state.guess!;
  const busy = state.pending === "feedback";
  const asked = state.history.length;
  const percent = guess.confidence === null ? null : Math.round(guess.confidence * 100);
  const meterId = useId();

  return (
    <section
      aria-labelledby="tahmin"
      aria-busy={busy}
      className="flex flex-1 flex-col justify-center py-8"
    >
      <h2 id="tahmin" ref={headingRef} tabIndex={-1} className={headingFocus}>
        <span className="block text-base font-medium text-fg-muted">
          {asked} sorudan sonra tahminim
        </span>
        <span className="reveal mt-2 block text-display font-bold tracking-[-0.035em] break-words">
          {guess.answer}
        </span>
      </h2>

      <dl className="mt-6 grid max-w-md gap-4 text-sm">
        {percent !== null && (
          <div>
            <dt className="flex justify-between text-fg-muted">
              <label htmlFor={meterId}>Eminlik</label>
              <span className="text-fg tabular-nums">%{percent}</span>
            </dt>
            <dd className="mt-2">
              <meter
                id={meterId}
                className="meter"
                min={0}
                max={1}
                low={0.35}
                high={0.6}
                optimum={1}
                value={guess.confidence ?? 0}
              />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-fg-muted">Kaynak</dt>
          <dd className="mt-0.5 text-fg">{SOURCE_LABEL[guess.source]}</dd>
        </div>
        {guess.alternatives.length > 0 && (
          <div>
            <dt className="text-fg-muted">Diğer adaylar</dt>
            <dd className="mt-0.5 text-fg">{guess.alternatives.join(", ")}</dd>
          </div>
        )}
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button variant="primary" busy={busy} onClick={() => onFeedback(true)} className="px-7">
          Doğru bildin
        </Button>
        <Button variant="secondary" busy={busy} onClick={() => onFeedback(false)} className="px-7">
          Yanlış
        </Button>
        <Button variant="ghost" busy={busy} onClick={onUndo} className="text-sm">
          Son cevabı geri al
        </Button>
      </div>
      <p aria-live="polite" className="mt-4 min-h-6 text-sm text-fg-muted">
        {busy ? "Kaydediliyor…" : ""}
      </p>
    </section>
  );
}

/* ───────────── Yanlış tahmin: doğru cevap ───────────── */

export function WrongScreen({
  state,
  headingRef,
  onSubmit,
  onSkip,
}: {
  state: State;
  headingRef: HeadingRef;
  onSubmit: (name: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = state.pending === "answer";
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const alternatives = state.guess?.alternatives ?? [];

  const submit = (name: string) => {
    if (busy) return;
    if (!EntityNameSchema.safeParse(name).success) {
      setError(
        name.trim() === ""
          ? "Cevabı yaz ya da adaylardan birini seç."
          : "Yalnız harf, rakam, boşluk, kesme ve tire kullan; en çok 60 karakter.",
      );
      return;
    }
    setError(null);
    onSubmit(name.trim());
  };

  return (
    <section
      aria-labelledby="dogru-cevap"
      aria-busy={busy}
      className="flex flex-1 flex-col justify-center py-8"
    >
      <h2
        id="dogru-cevap"
        ref={headingRef}
        tabIndex={-1}
        className={`text-question font-semibold tracking-[-0.02em] ${headingFocus}`}
      >
        Aklındaki neydi?
      </h2>
      <p className="mt-3 max-w-[50ch] text-fg-muted">
        Söylersen verdiğin {state.history.length} cevap ona eklenir; bir dahaki sefere daha iyi
        tahmin ederim.
      </p>

      {alternatives.length > 0 && (
        <fieldset className="mt-8">
          <legend className="text-sm text-fg-muted">Adaylardan biri miydi?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {alternatives.map((name) => (
              <Button
                key={name}
                variant="secondary"
                busy={busy}
                onClick={() => submit(name)}
                className="min-h-11 px-4 text-sm"
              >
                {name}
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      <form
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit(value);
        }}
        className="mt-8 max-w-md"
      >
        <label htmlFor={inputId} className="block text-sm font-medium">
          {alternatives.length > 0 ? "Başka bir şeyse yaz" : "Cevabın"}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="mt-2 block min-h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-base text-fg placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 aria-invalid:border-danger"
          placeholder="Örneğin: Zürafa"
        />
        <p id={hintId} className="mt-2 text-xs text-fg-subtle">
          En çok 60 karakter.
        </p>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" variant="primary" busy={busy} className="px-7">
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button variant="ghost" busy={busy} onClick={onSkip}>
            Söylemeden bitir
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ───────────── Sonuç ───────────── */

export function DoneScreen({
  state,
  headingRef,
  onRestart,
}: {
  state: State;
  headingRef: HeadingRef;
  onRestart: () => void;
}) {
  const outcome = state.outcome!;
  const n = state.history.length;
  const title =
    outcome.kind === "correct"
      ? `Bildim: ${outcome.name}`
      : outcome.kind === "learned"
        ? "Kaydedildi"
        : "Oyun kaydedildi";
  const body =
    outcome.kind === "skipped"
      ? "Cevabı yazmadın; bu oyun yalnız başarı oranına sayıldı."
      : `Motor bu oyundan öğrendi: ${n} cevap ${outcome.name} için eklendi.`;

  return (
    <section aria-labelledby="sonuc" className="flex flex-1 flex-col justify-center py-8">
      <h2
        id="sonuc"
        ref={headingRef}
        tabIndex={-1}
        className={`text-question font-semibold tracking-[-0.02em] ${headingFocus}`}
      >
        {title}
      </h2>
      <p className="mt-3 max-w-[50ch] text-fg-muted">{body}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onRestart} className="px-7">
          Tekrar oyna
        </Button>
        <Link
          href="/istatistik"
          className="inline-flex min-h-12 items-center rounded-lg px-5 font-medium text-fg-muted no-underline transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          İstatistikler
        </Link>
      </div>
    </section>
  );
}

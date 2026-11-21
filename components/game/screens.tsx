import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Folder, SideHeading } from "@/components/Folder";
import { EntityNameSchema } from "@/lib/schemas";
import { MAX_QUESTIONS, type Answer, type GuessSource, type Mode } from "@/lib/types";
import type { HistoryItem, Outcome, State } from "./state";
import { Button, Kbd, Tally } from "./ui";

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

const MODE_LABEL: Record<Mode, string> = {
  tree: "soru ağacı",
  engine: "öğrenen motor",
};

const headingFocus = "outline-none focus-visible:outline-none";
const questionType = "font-bold text-question tracking-[-0.01em]";

/* ───────────── Başlangıç ───────────── */

export function StartScreen({
  onStart,
  headingRef,
}: {
  onStart: () => void;
  headingRef: HeadingRef;
}) {
  return (
    <section aria-labelledby="baslik">
      <Folder tab="Yeni dosya">
        <h1
          id="baslik"
          ref={headingRef}
          tabIndex={-1}
          className={`max-w-[14ch] text-display font-bold tracking-[-0.02em] ${headingFocus}`}
        >
          Aklından bir şey tut.
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg text-fg-muted">
          Bir hayvan, bir eşya, bir yer ya da bir duygu olabilir. Ben soru sorarım; sen evet, hayır
          ya da bilmiyorum dersin. En çok {MAX_QUESTIONS} soruda bulmaya çalışırım.
        </p>
        <hr className="rule-dashed my-7 sm:my-9" />
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          <Button variant="primary" size="xl" tilt={-1.5} onClick={onStart}>
            Oyuna başla
          </Button>
          <p className="hidden text-sm text-fg-muted italic sm:block">
            Klavyeyle de oynanır: E evet, H hayır, B bilmiyorum.
          </p>
        </div>
      </Folder>
    </section>
  );
}

const LEARNING_STEPS: ReactNode[] = [
  "Her varlık için soru başına üç sayaç tutarım: kaç kişi evet, hayır ya da bilmiyorum dedi. Soru ağacındaki yollar ilk bilgiyi verir.",
  "Her cevaptan sonra adayların olasılığını Bayes kuralıyla güncellerim. Hiç görülmemiş cevap sıfır sayılmasın diye sayaçlara bir eklerim (Laplace düzeltmesi).",
  <>
    Sıradaki soru, adayları en iyi ayıran sorudur: beklenen bilgi kazancı en yüksek olan.
    <span className="mt-2 block text-fg-muted">
      IG(q) = H(p) − Σ<sub>a</sub> P(a) · H(p | a)
    </span>
  </>,
  "Bir aday yüzde 60’ı geçince tahmin ederim. Adaylar zayıf kalırsa Gemini’ye cevaplarını ve ilk beş adayı gönderirim.",
  "Oyun bitince cevapların doğru varlığın sayaçlarına eklenir. Sonraki oyun bu veriyle başlar.",
];

export function HowItLearns() {
  return (
    <section aria-labelledby="ogrenme">
      <SideHeading
        id="ogrenme"
        title="Nasıl öğreniyor?"
        note="Her oyundan sonra motor şu adımlarla güncellenir."
      />
      <ol className="mt-3.5 border-t border-line text-sm">
        {LEARNING_STEPS.map((step, i) => (
          <li
            key={i}
            className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-line py-3"
          >
            <span className="text-fg-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ───────────── Soru ───────────── */

const ANSWER_KEYS: {
  answer: Answer;
  key: string;
  variant: "primary" | "secondary" | "dashed";
  tilt: number;
  className?: string;
}[] = [
  { answer: "evet", key: "E", variant: "primary", tilt: -1.5 },
  { answer: "hayır", key: "H", variant: "secondary", tilt: 1 },
  {
    answer: "bilmiyorum",
    key: "B",
    variant: "dashed",
    tilt: -0.5,
    className: "col-span-2 text-stamp-md sm:text-2xl",
  },
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

  return (
    <section aria-labelledby="soru" aria-busy={busy}>
      <Folder tab={`${number}. sorgu`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="text-sm text-fg-muted tabular-nums">
            Soru {number} / {MAX_QUESTIONS}
          </p>
          <div className="flex items-center gap-2.5">
            <Tally count={asked} label={`Sorulan: ${asked}, toplam ${MAX_QUESTIONS}`} />
            <span className="text-sm text-fg-muted">{MAX_QUESTIONS - asked} hak kaldı</span>
          </div>
        </div>
        <hr className="rule-dashed mt-4 mb-6 sm:mt-5 sm:mb-7" />

        {/* Başlık hep yerinde kalır; odak ve canlı bölge soru değişiminde kaybolmaz. */}
        <div aria-live="polite" className="min-h-28">
          <h1
            id="soru"
            ref={headingRef}
            tabIndex={-1}
            className={`max-w-[22ch] ${questionType} ${headingFocus}`}
          >
            {busy || !state.question ? (
              <span className="block">
                <span aria-hidden="true" className="skeleton block h-7 w-4/5" />
                <span aria-hidden="true" className="skeleton mt-3 block h-7 w-1/2" />
                <span className="mt-4 block text-base font-normal tracking-normal text-fg-muted italic">
                  Düşünüyorum…
                </span>
              </span>
            ) : (
              <span key={state.question.id} className="enter block">
                {state.question.text}
              </span>
            )}
          </h1>
        </div>
        <p className="mt-4 hidden text-fg-muted italic sm:block">
          Cevabını mühürle. Klavyeyle de olur: E, H, B.
        </p>

        <div
          role="group"
          aria-label="Cevabın"
          className="mt-6 grid grid-cols-2 gap-3.5 sm:mt-9 sm:flex sm:flex-wrap sm:gap-[18px]"
        >
          {ANSWER_KEYS.map(({ answer, key, variant, tilt, className = "" }) => (
            <Button
              key={answer}
              variant={variant}
              tilt={tilt}
              busy={busy}
              onClick={() => onAnswer(answer)}
              aria-keyshortcuts={key}
              className={`min-h-16 px-3 text-stamp-lg sm:min-h-[72px] sm:flex-[1_1_150px] sm:text-stamp-xl ${className}`}
            >
              {ANSWER_LABEL[answer]}
              <Kbd>{key}</Kbd>
            </Button>
          ))}
        </div>
      </Folder>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="quiet" onClick={onUndo} busy={busy || asked === 0} aria-keyshortcuts="G">
          <UndoIcon />
          Son cevabı geri al
          <Kbd>G</Kbd>
        </Button>
        {state.mode && <p className="text-sm text-fg-muted">Mod: {MODE_LABEL[state.mode]}</p>}
      </div>
    </section>
  );
}

function UndoIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3L2 6l3 3" />
      <path d="M2 6h7.5a4 4 0 010 8H7" />
    </svg>
  );
}

/* ───────────── Sağ sütun: tutanak ve şüpheliler ───────────── */

const VERDICT_CLASS: Record<Answer, string> = {
  evet: "text-mark",
  hayır: "text-fg [border-color:var(--line-strong)]",
  bilmiyorum: "border-dashed text-fg-muted",
};

export function AnswerLog({ history }: { history: HistoryItem[] }) {
  return (
    <section aria-labelledby="tutanak">
      <SideHeading id="tutanak" title="İfade tutanağı" note="Verdiğin cevaplar, sırasıyla." />
      {history.length === 0 ? (
        <p className="mt-3.5 border-y border-line py-3 text-sm text-fg-muted">
          Henüz cevap yok. İlk cevabın buraya yazılır.
        </p>
      ) : (
        <ol className="mt-3.5 border-t border-line">
          {history.map((item, i) => (
            <li
              key={item.questionId}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5 text-sm"
            >
              <span className="text-fg-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span>{item.text}</span>
              <span className={`verdict ${VERDICT_CLASS[item.answer]}`}>
                {ANSWER_LABEL[item.answer]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Suspects({ names, note }: { names: string[]; note: string }) {
  if (names.length === 0) return null;
  return (
    <section aria-labelledby="supheli">
      <SideHeading id="supheli" title="Şüpheliler" note={note} />
      <ul className="mt-3.5 grid grid-cols-2 gap-2.5">
        {names.map((name) => (
          <li
            key={name}
            className="flex min-w-0 items-center gap-3 border border-surface-line bg-surface px-3.5 py-3"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="26"
              viewBox="0 0 26 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 text-fg-muted"
            >
              <circle cx="13" cy="10" r="6" />
              <path d="M2 29c1-7 5-10 11-10s10 3 11 10" />
            </svg>
            <span className="min-w-0 text-lg break-words text-fg-strong">{name}</span>
          </li>
        ))}
      </ul>
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
    <section aria-labelledby="tahmin" aria-busy={busy}>
      <Folder tab="Hüküm">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="text-sm text-fg-muted">Kaynak: {SOURCE_LABEL[guess.source]}</p>
          <Tally count={asked} label={`Sorulan: ${asked}, toplam ${MAX_QUESTIONS}`} />
        </div>
        <hr className="rule-dashed mt-4 mb-6 sm:mt-5 sm:mb-7" />

        <h1 id="tahmin" ref={headingRef} tabIndex={-1} className={headingFocus}>
          <span className="block text-lg text-fg-muted italic">{asked} sorudan sonra tahminim</span>
          <span className="reveal mt-2 block text-display font-bold tracking-[-0.02em] break-words">
            {guess.answer}
          </span>
        </h1>

        {percent !== null && (
          <div className="mt-7 max-w-md">
            <div className="flex justify-between text-sm">
              <label htmlFor={meterId} className="text-fg-muted">
                Eminlik
              </label>
              <span className="font-bold tabular-nums">%{percent}</span>
            </div>
            <meter
              id={meterId}
              className="meter mt-2"
              min={0}
              max={1}
              low={0.35}
              high={0.6}
              optimum={1}
              value={guess.confidence ?? 0}
            />
          </div>
        )}

        <hr className="rule-dashed my-7 sm:my-9" />
        <div className="flex flex-wrap items-center gap-3.5 sm:gap-[18px]">
          <Button
            variant="primary"
            busy={busy}
            size="lg"
            tilt={-1.5}
            onClick={() => onFeedback(true)}
          >
            Doğru bildin
          </Button>
          <Button
            variant="secondary"
            busy={busy}
            size="lg"
            tilt={1}
            onClick={() => onFeedback(false)}
          >
            Yanlış
          </Button>
          <Button variant="ghost" busy={busy} onClick={onUndo}>
            Son cevabı geri al
          </Button>
        </div>
        <p aria-live="polite" className="mt-3 min-h-6 text-sm text-fg-muted italic">
          {busy ? "Kaydediliyor…" : ""}
        </p>
      </Folder>
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
    <section aria-labelledby="dogru-cevap" aria-busy={busy}>
      <Folder tab="Eksik ifade">
        <h1
          id="dogru-cevap"
          ref={headingRef}
          tabIndex={-1}
          className={`${questionType} ${headingFocus}`}
        >
          Aklındaki neydi?
        </h1>
        <p className="mt-3 max-w-[52ch] text-fg-muted">
          Söylersen verdiğin {state.history.length} cevap ona eklenir; bir dahaki sefere daha iyi
          tahmin ederim.
        </p>

        {alternatives.length > 0 && (
          <fieldset className="mt-8">
            <legend className="text-sm text-fg-muted">Adaylardan biri miydi?</legend>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {alternatives.map((name) => (
                <Button
                  key={name}
                  variant="secondary"
                  busy={busy}
                  onClick={() => submit(name)}
                  className="min-h-11 border-2 px-4 text-base"
                >
                  {name}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        <hr className="rule-dashed my-7" />
        <form
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(value);
          }}
          className="max-w-md"
        >
          <label htmlFor={inputId} className="block text-sm font-bold">
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
            className="field mt-2"
            placeholder="Örneğin: Zürafa"
          />
          <p id={hintId} className="mt-2 text-xs text-fg-subtle">
            En çok 60 karakter.
          </p>
          {error && (
            <p id={errorId} role="alert" className="mt-1 text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3.5">
            <Button type="submit" variant="primary" busy={busy} size="lg" tilt={-1}>
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button variant="ghost" busy={busy} onClick={onSkip}>
              Söylemeden bitir
            </Button>
          </div>
        </form>
      </Folder>
    </section>
  );
}

/* ───────────── Sonuç ───────────── */

const CLOSING: Record<Outcome["kind"], string> = {
  correct: "Çözüldü",
  learned: "Öğrenildi",
  skipped: "Kapandı",
};

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
    <section aria-labelledby="sonuc">
      <Folder tab="Dosya kapandı">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <h1
            id="sonuc"
            ref={headingRef}
            tabIndex={-1}
            className={`min-w-0 break-words ${questionType} ${headingFocus}`}
          >
            {title}
          </h1>
          <span aria-hidden="true" className="closing-stamp mt-1 mr-2">
            {CLOSING[outcome.kind]}
          </span>
        </div>
        <p className="mt-4 max-w-[52ch] text-fg-muted">{body}</p>
        <hr className="rule-dashed my-7 sm:my-9" />
        <div className="flex flex-wrap items-center gap-3.5">
          <Button variant="primary" size="lg" tilt={-1.5} onClick={onRestart}>
            Tekrar oyna
          </Button>
          <Link href="/istatistik" className="btn-ghost">
            İstatistikler
          </Link>
        </div>
      </Folder>
    </section>
  );
}

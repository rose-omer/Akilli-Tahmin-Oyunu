import type { RefObject } from "react";
import type { GameError } from "./state";
import { Button } from "./ui";

const COPY: Record<GameError["kind"], { title: string; body: string }> = {
  rate_limited: {
    title: "Çok hızlı gidiyorsun",
    body: "Birkaç saniye bekle, sonra tekrar dene. Cevapların duruyor.",
  },
  invalid: {
    title: "Bu adım kabul edilmedi",
    body: "Oyunun durumu sunucuyla uyuşmadı. Yeni bir oyun başlatman gerekiyor.",
  },
  server: {
    title: "Sunucu şu an yanıt vermiyor",
    body: "Cevapların duruyor. Tekrar dene ya da yeni bir oyun başlat.",
  },
  network: {
    title: "Bağlantı kurulamadı",
    body: "İnternet bağlantını kontrol et ve tekrar dene. Cevapların duruyor.",
  },
};

export function ErrorCard({
  error,
  headingRef,
  onRetry,
  onReset,
  onUndo,
}: {
  error: GameError;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onReset: () => void;
  onUndo?: () => void;
}) {
  const copy = COPY[error.kind];
  const canRetry = error.kind !== "invalid";
  return (
    <section
      role="alert"
      aria-labelledby="hata-baslik"
      className="enter my-auto rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="mt-1 size-5 shrink-0 text-danger"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6v4.5M10 13.6v.1" />
        </svg>
        <div>
          <h2
            id="hata-baslik"
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold tracking-[-0.01em] outline-none"
          >
            {copy.title}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-fg-muted">{copy.body}</p>
          {error.requestId && (
            <p className="mt-3 text-xs text-fg-subtle">
              Hata kodu: <span className="tabular-nums">{error.requestId}</span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {canRetry && (
          <Button variant="primary" onClick={onRetry}>
            Tekrar dene
          </Button>
        )}
        <Button variant={canRetry ? "secondary" : "primary"} onClick={onReset}>
          Yeni oyun
        </Button>
        {onUndo && (
          <Button variant="ghost" onClick={onUndo}>
            Son cevabı geri al
          </Button>
        )}
      </div>
    </section>
  );
}

import type { RefObject } from "react";
import { Folder } from "@/components/Folder";
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
    <section role="alert" aria-labelledby="hata-baslik" className="enter">
      <Folder tab="Sorgu kesildi">
        <div className="flex items-start gap-3.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mt-1.5 size-7 shrink-0 text-stamp"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 3l10 18H2z" strokeLinejoin="round" />
            <path d="M12 10v5M12 18v.1" />
          </svg>
          <div className="min-w-0">
            <h1
              id="hata-baslik"
              ref={headingRef}
              tabIndex={-1}
              className="text-question font-bold tracking-[-0.01em] outline-none"
            >
              {copy.title}
            </h1>
            <p className="mt-3 max-w-[52ch] text-fg-muted">{copy.body}</p>
            {error.requestId && (
              <p className="mt-3 text-sm text-fg-subtle">
                Hata kodu: <span className="font-bold tabular-nums">{error.requestId}</span>
              </p>
            )}
          </div>
        </div>
        <hr className="rule-dashed my-7" />
        <div className="flex flex-wrap items-center gap-3.5">
          {canRetry && (
            <Button variant="primary" size="lg" tilt={-1} onClick={onRetry}>
              Tekrar dene
            </Button>
          )}
          <Button variant={canRetry ? "secondary" : "primary"} size="lg" tilt={1} onClick={onReset}>
            Yeni oyun
          </Button>
          {onUndo && (
            <Button variant="ghost" onClick={onUndo}>
              Son cevabı geri al
            </Button>
          )}
        </div>
      </Folder>
    </section>
  );
}

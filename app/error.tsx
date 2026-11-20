"use client";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="my-auto py-12">
      <h1 className="text-question font-semibold tracking-[-0.02em]">Sayfa açılamadı</h1>
      <p className="mt-3 max-w-[50ch] text-fg-muted">
        Beklenmeyen bir sorun oldu. Sayfayı yeniden yüklemeyi dene.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-accent px-7 font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
      >
        Yeniden yükle
      </button>
    </section>
  );
}

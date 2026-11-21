"use client";

import { Folder } from "@/components/Folder";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="max-w-3xl">
      <Folder tab="Sorgu kesildi">
        <h1 className="text-question font-bold tracking-[-0.01em]">Sayfa açılamadı</h1>
        <p className="mt-3 max-w-[50ch] text-fg-muted">
          Beklenmeyen bir sorun oldu. Sayfayı yeniden yüklemeyi dene.
        </p>
        <hr className="rule-dashed my-7" />
        <button type="button" onClick={reset} className="stamp stamp-solid stamp-lg [--tilt:-1deg]">
          Yeniden yükle
        </button>
      </Folder>
    </section>
  );
}

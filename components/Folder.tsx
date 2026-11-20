import type { ReactNode } from "react";

/** Sorgu odasının ana yüzeyi: sekmeli manila dosya ve içindeki kâğıt. */
export function Folder({ tab, children }: { tab: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="folder-tab">{tab}</p>
      <div className="folder-body">
        <div className="sheet">{children}</div>
      </div>
    </div>
  );
}

/** Oda tarafındaki (sağ sütun) bölüm başlığı ve kısa açıklaması. */
export function SideHeading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <>
      <h2 id={id} className="font-display text-lg font-medium tracking-[0.02em] text-fg-strong">
        {title}
      </h2>
      {note && <p className="mt-1 text-sm text-fg-muted">{note}</p>}
    </>
  );
}

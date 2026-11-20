import type { Metadata } from "next";
import Link from "next/link";
import { Folder, SideHeading } from "@/components/Folder";
import { getStore } from "@/lib/game/runtime";
import type { Statistics } from "@/lib/store/types";
import type { GuessSource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İstatistikler" };

const SOURCE_LABEL: Record<GuessSource, string> = {
  tree: "Soru ağacı",
  model: "Öğrenen motor",
  gemini: "Gemini",
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const weekFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("tr-TR");

export default async function StatisticsPage() {
  const store = getStore();
  let stats: Statistics | null = null;
  try {
    stats = await store.getStatistics(new Date());
  } catch (error) {
    console.error("[istatistik] yüklenemedi:", error);
  }
  const filled = stats !== null && stats.totalGames > 0;

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Folder tab="Sicil">
        <h1 className="text-question font-bold tracking-[-0.01em]">İstatistikler</h1>
        <p className="mt-3 max-w-[56ch] text-fg-muted">
          Her oyun kaydedilir ve motorun sayaçlarını besler. Bu sayfa motorun ne kadar iyi tahmin
          ettiğini ve bilgiyi nereden aldığını gösterir.
        </p>
        <hr className="rule-dashed mt-6 mb-7" />
        {stats === null ? (
          <Empty
            title="İstatistikler yüklenemedi"
            body="Veritabanına şu an ulaşılamıyor. Biraz sonra sayfayı yenile."
          />
        ) : stats.totalGames === 0 ? (
          <Empty
            title="Henüz oyun yok"
            body="İlk oyunu sen oyna; sonuçlar burada görünür."
            action
          />
        ) : (
          <Ledger stats={stats} />
        )}
      </Folder>

      {(!store.persistent || filled) && (
        <aside aria-label="Ayrıntılar" className="grid min-w-0 gap-8">
          {!store.persistent && (
            <section aria-labelledby="kayit-notu">
              <SideHeading id="kayit-notu" title="Kayıt notu" />
              <p className="mt-2 border-y border-line py-3 text-sm">
                Veritabanı bağlı değil. Sayılar yalnız bu sunucu açıkken bellekte tutulur.
              </p>
            </section>
          )}
          {filled && <Sources stats={stats!} />}
          {filled && <TopEntities stats={stats!} />}
        </aside>
      )}
    </div>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: boolean }) {
  return (
    <section aria-labelledby="bos">
      <h2 id="bos" className="text-lg font-bold">
        {title}
      </h2>
      <p className="mt-1.5 text-fg-muted">{body}</p>
      {action && (
        <Link href="/" className="stamp stamp-solid stamp-lg mt-7 [--tilt:-1.5deg]">
          Oyuna başla
        </Link>
      )}
    </section>
  );
}

function Ledger({ stats }: { stats: Statistics }) {
  const summary = [
    { label: "Oynanan oyun", value: numberFormat.format(stats.totalGames) },
    { label: "Doğru tahmin", value: `%${pct(stats.correctGames, stats.totalGames)}` },
    { label: "Öğrenilen varlık", value: numberFormat.format(stats.learnedEntities) },
    { label: "Bekleyen soru", value: numberFormat.format(stats.pendingQuestions) },
  ];

  return (
    <div className="grid gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {summary.map((s) => (
          <div
            key={s.label}
            className="flex flex-col justify-between border-l border-dashed border-line-strong pl-3.5"
          >
            <dt className="text-sm text-fg-muted">{s.label}</dt>
            <dd className="mt-1 text-[1.75rem] leading-tight font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="haftalik">
        <h2 id="haftalik" className="text-lg font-bold">
          Haftalık başarı
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Son 12 hafta; hafta pazartesi başlar.</p>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-fg-muted">
            <tr className="border-b border-fg">
              <th scope="col" className="py-2 font-normal">
                Hafta
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Oyun
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Doğru
              </th>
              <th scope="col" className="py-2 pl-5 text-right font-normal sm:w-2/5 sm:text-left">
                Oran
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {stats.weekly.map((w) => {
              const rate = pct(w.correct, w.total);
              return (
                <tr key={w.weekStart} className="border-b border-dashed border-line-strong">
                  <th scope="row" className="py-2.5 text-left font-normal">
                    {weekFormat.format(new Date(w.weekStart))}
                  </th>
                  <td className="py-2.5 text-right">{w.total}</td>
                  <td className="py-2.5 text-right">{w.correct}</td>
                  <td className="py-2.5 pl-5">
                    <span className="flex items-center justify-end gap-3 sm:justify-start">
                      <span aria-hidden="true" className="ink-bar hidden sm:block">
                        <span style={{ width: `${rate}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right font-bold">%{rate}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Sources({ stats }: { stats: Statistics }) {
  return (
    <section aria-labelledby="kaynak">
      <SideHeading
        id="kaynak"
        title="Tahmini kim yaptı?"
        note="Çubuk: oyunların yüzde kaçında bu kaynak tahmin etti."
      />
      <ul className="mt-3.5 border-t border-line">
        {stats.bySource.map((s) => (
          <li key={s.source} className="border-b border-line py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="text-fg-strong">{SOURCE_LABEL[s.source]}</span>
              <span className="text-fg-muted tabular-nums">
                {s.total} oyun, %{pct(s.correct, s.total)} doğru
              </span>
            </div>
            <span aria-hidden="true" className="room-bar mt-2">
              <span style={{ width: `${pct(s.total, stats.totalGames)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopEntities({ stats }: { stats: Statistics }) {
  return (
    <section aria-labelledby="bilinenler">
      <SideHeading id="bilinenler" title="En çok bilinenler" note="Doğru tahmin sayısına göre." />
      {stats.topEntities.length === 0 ? (
        <p className="mt-3.5 border-y border-line py-3 text-sm text-fg-muted">
          Henüz doğru tahmin yok.
        </p>
      ) : (
        <ol className="mt-3.5 border-t border-line">
          {stats.topEntities.map((e, i) => (
            <li
              key={e.name}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5 text-sm"
            >
              <span className="text-fg-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-fg-strong">{e.name}</span>
              <span className="verdict text-mark">{e.correct} kez</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

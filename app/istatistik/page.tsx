import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <div className="py-8 sm:py-12">
      <h1 className="text-question font-semibold tracking-[-0.02em]">İstatistikler</h1>
      <p className="mt-3 max-w-[56ch] text-fg-muted">
        Her oyun kaydedilir ve motorun sayaçlarını besler. Bu sayfa motorun ne kadar iyi tahmin
        ettiğini ve bilgiyi nereden aldığını gösterir.
      </p>
      {!store.persistent && (
        <p className="mt-4 max-w-[56ch] rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">
          Veritabanı bağlı değil. Sayılar yalnız bu sunucu açıkken bellekte tutulur.
        </p>
      )}

      {stats === null ? (
        <Empty
          title="İstatistikler yüklenemedi"
          body="Veritabanına şu an ulaşılamıyor. Biraz sonra sayfayı yenile."
        />
      ) : stats.totalGames === 0 ? (
        <Empty title="Henüz oyun yok" body="İlk oyunu sen oyna; sonuçlar burada görünür." action />
      ) : (
        <Filled stats={stats} />
      )}
    </div>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: boolean }) {
  return (
    <section aria-labelledby="bos" className="mt-12 border-t border-line pt-8">
      <h2 id="bos" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1.5 text-fg-muted">{body}</p>
      {action && (
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-accent px-7 font-medium text-accent-fg no-underline transition-colors duration-150 hover:bg-accent-strong"
        >
          Oyuna başla
        </Link>
      )}
    </section>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <span className="block h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </span>
  );
}

function Filled({ stats }: { stats: Statistics }) {
  const summary = [
    { label: "Oynanan oyun", value: numberFormat.format(stats.totalGames) },
    { label: "Doğru tahmin", value: `%${pct(stats.correctGames, stats.totalGames)}` },
    { label: "Öğrenilen varlık", value: numberFormat.format(stats.learnedEntities) },
    { label: "Bekleyen soru", value: numberFormat.format(stats.pendingQuestions) },
  ];

  return (
    <div className="mt-10 grid gap-12">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-fg-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="haftalik">
        <h2 id="haftalik" className="text-lg font-semibold">
          Haftalık başarı
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Son 12 hafta; hafta pazartesi başlar.</p>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-fg-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 font-medium">
                Hafta
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Oyun
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Doğru
              </th>
              <th scope="col" className="w-2/5 py-2 pl-6 font-medium">
                Oran
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {stats.weekly.map((w) => {
              const rate = pct(w.correct, w.total);
              return (
                <tr key={w.weekStart} className="border-b border-line">
                  <th scope="row" className="py-2.5 text-left font-normal">
                    {weekFormat.format(new Date(w.weekStart))}
                  </th>
                  <td className="py-2.5 text-right">{w.total}</td>
                  <td className="py-2.5 text-right">{w.correct}</td>
                  <td className="py-2.5 pl-6">
                    <span className="flex items-center gap-3">
                      <Bar value={rate} />
                      <span className="w-10 shrink-0 text-right">%{rate}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-12 sm:grid-cols-2">
        <section aria-labelledby="kaynak">
          <h2 id="kaynak" className="text-lg font-semibold">
            Tahmini kim yaptı?
          </h2>
          <ul className="mt-4 grid gap-4">
            {stats.bySource.map((s) => (
              <li key={s.source}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{SOURCE_LABEL[s.source]}</span>
                  <span className="text-fg-muted tabular-nums">
                    {s.total} oyun, %{pct(s.correct, s.total)} doğru
                  </span>
                </div>
                <div className="mt-2">
                  <Bar value={pct(s.total, stats.totalGames)} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-subtle">
            Çubuk: oyunların yüzde kaçında bu kaynak tahmin etti.
          </p>
        </section>

        <section aria-labelledby="bilinenler">
          <h2 id="bilinenler" className="text-lg font-semibold">
            En çok bilinenler
          </h2>
          {stats.topEntities.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">Henüz doğru tahmin yok.</p>
          ) : (
            <ol className="mt-4 divide-y divide-line border-y border-line text-sm">
              {stats.topEntities.map((e) => (
                <li key={e.name} className="flex justify-between py-2.5">
                  <span>{e.name}</span>
                  <span className="text-fg-muted tabular-nums">{e.correct} kez</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

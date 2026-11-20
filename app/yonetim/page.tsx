import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { getStore } from "@/lib/game/runtime";
import type { PendingQuestion } from "@/lib/store/types";
import { logout, review } from "./actions";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Soru onayı", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminPage() {
  const env = getEnv();
  if (!env.ADMIN_TOKEN) notFound();
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  const signedIn = isAdminSession(session, env.ADMIN_TOKEN);

  let pending: PendingQuestion[] | null = null;
  if (signedIn) {
    try {
      pending = await getStore().listPendingQuestions();
    } catch (error) {
      console.error("[yonetim] sorular yüklenemedi:", error);
    }
  }

  return (
    <div className="py-8 sm:py-12">
      <h1 className="text-question font-semibold tracking-[-0.02em]">Soru onayı</h1>
      <p className="mt-3 max-w-[56ch] text-fg-muted">
        Gemini, yeni bir varlık öğrenilince ayırt edici bir soru önerir. Öneri, burada onaylanmadan
        motorun soru havuzuna girmez.
      </p>

      {!signedIn ? (
        <LoginForm />
      ) : (
        <>
          {pending === null ? (
            <Notice
              title="Sorular yüklenemedi"
              body="Veritabanına şu an ulaşılamıyor. Sayfayı yenile."
            />
          ) : pending.length === 0 ? (
            <Notice
              title="Onay bekleyen soru yok"
              body="Yeni öneriler geldikçe burada listelenir."
            />
          ) : (
            <section aria-labelledby="bekleyen" className="mt-10">
              <h2 id="bekleyen" className="text-lg font-semibold">
                Bekleyen öneriler{" "}
                <span className="text-fg-muted tabular-nums">({pending.length})</span>
              </h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {pending.map((q) => (
                  <li
                    key={q.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-fg">{q.text}</p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        <time dateTime={q.createdAt.toISOString()}>
                          {dateFormat.format(q.createdAt)}
                        </time>
                      </p>
                    </div>
                    <form action={review} className="flex shrink-0 gap-2">
                      <input type="hidden" name="id" value={q.id} />
                      <button
                        type="submit"
                        name="karar"
                        value="onay"
                        aria-label={`Onayla: ${q.text}`}
                        className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
                      >
                        Onayla
                      </button>
                      <button
                        type="submit"
                        name="karar"
                        value="ret"
                        aria-label={`Reddet: ${q.text}`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg transition-colors duration-150 hover:border-line-strong hover:bg-surface-3"
                      >
                        Reddet
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <form action={logout} className="mt-10">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              Çıkış yap
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section aria-labelledby="durum" className="mt-10 border-t border-line pt-8">
      <h2 id="durum" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1.5 text-fg-muted">{body}</p>
    </section>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { Folder } from "@/components/Folder";
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
    <div className="max-w-4xl">
      <Folder tab="Yönetim">
        <h1 className="text-question font-bold tracking-[-0.01em]">Soru onayı</h1>
        <p className="mt-3 max-w-[56ch] text-fg-muted">
          Gemini, yeni bir varlık öğrenilince ayırt edici bir soru önerir. Öneri, burada
          onaylanmadan motorun soru havuzuna girmez.
        </p>
        <hr className="rule-dashed mt-6 mb-7" />

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
              <section aria-labelledby="bekleyen">
                <h2 id="bekleyen" className="text-lg font-bold">
                  Bekleyen öneriler{" "}
                  <span className="text-fg-muted tabular-nums">({pending.length})</span>
                </h2>
                <ul className="mt-4 border-t border-fg">
                  {pending.map((q) => (
                    <li
                      key={q.id}
                      className="flex flex-col gap-3 border-b border-dashed border-line-strong py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-fg">{q.text}</p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          <time dateTime={q.createdAt.toISOString()}>
                            {dateFormat.format(q.createdAt)}
                          </time>
                        </p>
                      </div>
                      <form action={review} className="flex shrink-0 gap-3">
                        <input type="hidden" name="id" value={q.id} />
                        <button
                          type="submit"
                          name="karar"
                          value="onay"
                          aria-label={`Onayla: ${q.text}`}
                          className="stamp stamp-solid min-h-11 border-2 px-4 text-base"
                        >
                          Onayla
                        </button>
                        <button
                          type="submit"
                          name="karar"
                          value="ret"
                          aria-label={`Reddet: ${q.text}`}
                          className="stamp stamp-outline min-h-11 border-2 px-4 text-base"
                        >
                          Reddet
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <form action={logout} className="mt-8">
              <button type="submit" className="btn-ghost -ml-2.5">
                Çıkış yap
              </button>
            </form>
          </>
        )}
      </Folder>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section aria-labelledby="durum">
      <h2 id="durum" className="text-lg font-bold">
        {title}
      </h2>
      <p className="mt-1.5 text-fg-muted">{body}</p>
    </section>
  );
}

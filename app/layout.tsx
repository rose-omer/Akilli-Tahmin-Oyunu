import type { Metadata, Viewport } from "next";
import { Courier_Prime, Oswald } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

// next/font yazı tiplerini derlemede indirir ve uygulamayla birlikte sunar.
// latin-ext: ğ, ş, ı, İ bu alt kümededir.
const courier = Courier_Prime({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-courier",
  display: "swap",
});
const oswald = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Akıllı Tahmin", template: "%s · Akıllı Tahmin" },
  description:
    "Aklından bir şey tut; en çok 30 evet/hayır sorusunda bulmaya çalışayım. Her oyundan öğrenen tahmin oyunu.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1f2a27" },
    { media: "(prefers-color-scheme: light)", color: "#d5ddd7" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${courier.variable} ${oswald.variable}`}>
      <body>
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-link"
        >
          İçeriğe geç
        </a>
        <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col">
          <header className="mx-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4 sm:mx-8 sm:py-5">
            <div className="flex flex-wrap items-baseline gap-x-3.5">
              <Link
                href="/"
                className="font-display text-stamp-md font-semibold tracking-[0.04em] text-fg-strong no-underline hover:text-fg-strong"
              >
                Akıllı Tahmin
              </Link>
              <span className="text-sm text-fg-muted">En çok 30 soruda bulur</span>
            </div>
            <SiteNav />
          </header>
          <main
            id="icerik"
            className="flex flex-1 flex-col px-4 pt-6 pb-12 sm:px-8 sm:pt-10 sm:pb-16"
          >
            {children}
          </main>
          <footer className="mx-4 border-t border-line py-5 text-xs text-fg-muted sm:mx-8">
            Oyunlar anonim kaydedilir. IP adresi yalnız tuzlu özet olarak, hız sınırı için kısa süre
            saklanır.
          </footer>
        </div>
      </body>
    </html>
  );
}

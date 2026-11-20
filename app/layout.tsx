import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

// latin-ext: ğ, ş, ı, İ bu alt kümededir.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Akıllı Tahmin", template: "%s · Akıllı Tahmin" },
  description:
    "Aklından bir şey tut; en çok 30 evet/hayır sorusunda bulmaya çalışayım. Her oyundan öğrenen tahmin oyunu.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16121d" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4f9" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="font-sans antialiased">
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-2 focus:px-4 focus:py-2"
        >
          İçeriğe geç
        </a>
        <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 sm:px-6">
          <header className="flex items-center justify-between py-5">
            <Link
              href="/"
              className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg no-underline"
            >
              Akıllı Tahmin
            </Link>
            <SiteNav />
          </header>
          <main id="icerik" className="flex flex-1 flex-col">
            {children}
          </main>
          <footer className="py-6 text-xs text-fg-subtle">
            Oyunlar anonim kaydedilir. IP adresi yalnız tuzlu özet olarak, hız sınırı için kısa süre
            saklanır.
          </footer>
        </div>
      </body>
    </html>
  );
}

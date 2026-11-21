"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Oyun" },
  { href: "/istatistik", label: "İstatistikler" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana menü" className="-mx-3.5 sm:ml-0">
      <ul className="flex gap-1">
        {LINKS.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center px-3.5 ${
                  current ? "underline" : "no-underline hover:underline"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

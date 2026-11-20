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
    <nav aria-label="Ana menü">
      <ul className="flex gap-1 text-sm">
        {LINKS.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 no-underline transition-colors duration-150 hover:bg-surface-2 hover:text-fg ${
                  current ? "text-fg" : "text-fg-muted"
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

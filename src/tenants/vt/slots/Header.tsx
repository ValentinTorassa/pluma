"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HeaderProps } from "../../types";
import { ThemeToggle } from "../components/ThemeToggle";
import { config } from "../config";
import { copy } from "../messages";

const m = copy.nav;

export function Header({ siteName }: HeaderProps) {
  const pathname = usePathname() ?? "/";
  const current = (active: boolean) => (active ? ("page" as const) : undefined);

  return (
    <div className="site">
      <header className="hdr">
        <Link className="brand" href="/">
          {siteName} <span>{copy.brandSuffix}</span>
        </Link>
        <nav aria-label={m.main}>
          <Link href="/" aria-current={current(pathname.startsWith("/articulo/"))}>
            {m.articles}
          </Link>
          {config.features.series && (
            <Link href="/series" aria-current={current(pathname.startsWith("/serie"))}>
              {m.series}
            </Link>
          )}
          {config.features.quincena && (
            <Link href="/quincena" aria-current={current(pathname.startsWith("/quincena"))}>
              {m.quincena}
            </Link>
          )}
          <Link href="/acerca" aria-current={current(pathname === "/acerca")}>
            {m.about}
          </Link>
          <ThemeToggle />
        </nav>
      </header>
    </div>
  );
}

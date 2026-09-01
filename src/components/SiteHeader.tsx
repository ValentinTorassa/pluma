"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";
import { ReaderMenu } from "./ReaderMenu";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false);

  const link =
    "block px-4 py-3 text-base text-ink transition-colors hover:bg-accent-soft md:inline md:px-0 md:py-0 md:text-sm md:text-muted md:hover:bg-transparent md:hover:text-ink md:link-underline";

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl flex-nowrap items-center gap-2 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-accent shadow-sm transition-all duration-300 group-hover:-rotate-12 group-hover:border-accent/40 sm:h-9 sm:w-9">
            <Logo className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="truncate font-serif text-xl font-semibold tracking-tight transition-colors group-hover:text-accent sm:text-2xl">
            {siteName}
          </span>
          <span className="ml-1 hidden self-center text-sm text-muted lg:inline">
            Yanina L. Colombero
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-4 text-sm md:flex">
          <Link href="/" className={link}>
            Artículos
          </Link>
          <Link href="/archivo" className={link}>
            Archivo
          </Link>
          <Link href="/acerca" className={link}>
            Acerca
          </Link>
          <SearchBox />
          <ThemeToggle />
          <ReaderMenu />
        </nav>

        <div className="ml-auto flex items-center gap-0.5 md:hidden">
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-accent-soft hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" strokeLinecap="round" />
            </svg>
          </Link>
          <ThemeToggle />
          <ReaderMenu />
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-accent-soft hover:text-ink"
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper md:hidden">
          <nav className="mx-auto max-w-3xl py-2">
            <Link href="/" className={link} onClick={() => setOpen(false)}>
              Artículos
            </Link>
            <Link href="/archivo" className={link} onClick={() => setOpen(false)}>
              Archivo
            </Link>
            <Link href="/acerca" className={link} onClick={() => setOpen(false)}>
              Acerca de
            </Link>
            <Link href="/buscar" className={link} onClick={() => setOpen(false)}>
              Buscar
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

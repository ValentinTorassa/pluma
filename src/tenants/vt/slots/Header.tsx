import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import type { HeaderProps } from "../../types";
import { Logo } from "../Logo";
import { messages } from "../messages";

/** TODO(phase4): header definitivo (menú mobile, estado activo, etc.). */
export function Header({ siteName }: HeaderProps) {
  const link = "text-sm text-muted transition-colors hover:text-accent";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={siteName}>
          <Logo className="text-lg" />
          <span className="hidden font-serif text-base font-semibold sm:inline">{siteName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link href="/" className={link}>
            {messages.nav.articles}
          </Link>
          <Link href="/archivo" className={`${link} hidden sm:inline`}>
            {messages.nav.archive}
          </Link>
          <Link href="/acerca" className={`${link} hidden sm:inline`}>
            {messages.nav.about}
          </Link>
          <SearchBox />
        </nav>
      </div>
    </header>
  );
}

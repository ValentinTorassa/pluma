import Link from "next/link";
import { config } from "@/pluma.config";
import { getSiteSettings } from "@/lib/settings";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const site = await getSiteSettings();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-accent shadow-sm transition-all duration-300 group-hover:-rotate-12 group-hover:border-accent/40">
              <Logo className="h-5 w-5" />
            </span>
            <span className="font-serif text-2xl font-semibold tracking-tight transition-colors group-hover:text-accent">
              {config.siteName}
            </span>
            <span className="ml-1 hidden self-center text-sm text-muted sm:inline">
              {site.authorName}
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm sm:gap-6">
            <Link
              href="/"
              className="link-underline text-muted transition-colors hover:text-ink"
            >
              Artículos
            </Link>
            <Link
              href="/archivo"
              className="link-underline text-muted transition-colors hover:text-ink"
            >
              Archivo
            </Link>
            <Link
              href="/acerca"
              className="link-underline text-muted transition-colors hover:text-ink"
            >
              Acerca de
            </Link>
            <SearchBox />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-10 text-xs uppercase tracking-widest text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.authorName} · {config.siteName}
          </p>
          <div className="flex gap-5">
            {site.authorEmail && (
              <a
                href={`mailto:${site.authorEmail}`}
                className="link-underline transition-colors hover:text-ink"
              >
                Contacto
              </a>
            )}
            {site.authorLinkedin && (
              <a
                href={site.authorLinkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline transition-colors hover:text-ink"
              >
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}

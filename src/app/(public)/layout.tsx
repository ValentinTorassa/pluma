import Link from "next/link";
import { config } from "@/pluma.config";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="group">
            <span className="font-serif text-2xl font-semibold tracking-tight group-hover:text-accent transition-colors">
              {config.siteName}
            </span>
            <span className="ml-3 hidden text-sm text-muted sm:inline">
              {config.author.name}
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted">
            <Link href="/" className="transition-colors hover:text-ink">
              Artículos
            </Link>
            <Link href="/acerca" className="transition-colors hover:text-ink">
              Acerca de
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {config.author.name} · {config.siteName}
          </p>
          <div className="flex gap-4">
            {config.author.email && (
              <a
                href={`mailto:${config.author.email}`}
                className="transition-colors hover:text-ink"
              >
                Contacto
              </a>
            )}
            {config.author.linkedin && (
              <a
                href={config.author.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-ink"
              >
                LinkedIn
              </a>
            )}
            <a href="/rss.xml" className="transition-colors hover:text-ink">
              RSS
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

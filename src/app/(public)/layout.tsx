import { config } from "@/pluma.config";
import { getSiteSettings } from "@/lib/settings";
import { BackToTop } from "@/components/BackToTop";
import { ReadingProgress } from "@/components/ReadingProgress";
import { SiteHeader } from "@/components/SiteHeader";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const site = await getSiteSettings();

  return (
    <>
      <SiteHeader siteName={config.siteName} />
      <ReadingProgress />

      <main className="flex-1">{children}</main>

      <BackToTop />
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

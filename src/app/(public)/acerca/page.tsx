import type { Metadata } from "next";
import { config } from "@/pluma.config";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: "Acerca de",
    description: `Sobre ${site.authorName}`,
  };
}

export default async function AboutPage() {
  const site = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Acerca de</h1>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        {config.author.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.author.avatarUrl}
            alt={site.authorName}
            className="h-40 w-40 shrink-0 rounded-2xl object-cover"
          />
        )}
        <div>
          <h2 className="font-serif text-2xl font-semibold">{site.authorName}</h2>
          <p className="mt-1 text-accent">{site.authorRole}</p>
          <div className="mt-4 space-y-4 leading-relaxed text-muted">
            {site.authorBio
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
          {(site.authorEmail || site.authorLinkedin) && (
            <div className="mt-6 flex gap-4 text-sm">
              {site.authorEmail && (
                <a
                  href={`mailto:${site.authorEmail}`}
                  className="rounded-full border border-line px-4 py-2 transition-colors hover:border-accent hover:text-accent"
                >
                  Email
                </a>
              )}
              {site.authorLinkedin && (
                <a
                  href={site.authorLinkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-line px-4 py-2 transition-colors hover:border-accent hover:text-accent"
                >
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

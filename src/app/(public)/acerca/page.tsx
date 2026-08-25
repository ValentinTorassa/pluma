import type { Metadata } from "next";
import { config } from "@/pluma.config";

export const metadata: Metadata = {
  title: "Acerca de",
  description: `Sobre ${config.author.name}`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Acerca de</h1>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        {config.author.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.author.avatarUrl}
            alt={config.author.name}
            className="h-40 w-40 shrink-0 rounded-2xl object-cover"
          />
        )}
        <div>
          <h2 className="font-serif text-2xl font-semibold">{config.author.name}</h2>
          <p className="mt-1 text-accent">{config.author.role}</p>
          <p className="mt-4 leading-relaxed text-muted">{config.author.bio}</p>
          {(config.author.email || config.author.linkedin) && (
            <div className="mt-6 flex gap-4 text-sm">
              {config.author.email && (
                <a
                  href={`mailto:${config.author.email}`}
                  className="rounded-full border border-line px-4 py-2 hover:border-accent hover:text-accent transition-colors"
                >
                  Email
                </a>
              )}
              {config.author.linkedin && (
                <a
                  href={config.author.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-line px-4 py-2 hover:border-accent hover:text-accent transition-colors"
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

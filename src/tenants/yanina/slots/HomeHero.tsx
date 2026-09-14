import type { HomeHeroProps } from "../../types";
import { Logo } from "../Logo";
import { messages } from "../messages";

export function HomeHero({ site }: HomeHeroProps) {
  return (
    <section className="relative mb-14">
      <Logo className="pointer-events-none absolute -right-2 -top-8 h-36 w-36 rotate-12 text-accent/[0.07] sm:h-44 sm:w-44" />
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        {messages.home.kicker}
      </p>
      <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-ink">
        {site.authorName}
      </h1>
      <p className="mt-3 text-lg italic text-accent">{site.authorRole}</p>
      <p className="mt-4 max-w-xl text-muted leading-relaxed">
        {site.siteDescription}
      </p>
      {site.authorLinkedin && (
        <p className="mt-6 text-sm">
          <a
            href={site.authorLinkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-accent hover:text-ink"
          >
            {messages.home.followLinkedin}
          </a>
        </p>
      )}
      <div
        aria-hidden
        className="mt-10 h-px w-full bg-gradient-to-r from-accent/60 via-line to-transparent"
      />
    </section>
  );
}

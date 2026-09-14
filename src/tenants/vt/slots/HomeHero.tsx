import type { HomeHeroProps } from "../../types";
import { messages } from "../messages";

/** TODO(phase4): hero definitivo. */
export function HomeHero({ site }: HomeHeroProps) {
  return (
    <section className="mb-12 border-b border-line pb-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        {messages.home.kicker}
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {site.authorName}
      </h1>
      <p className="mt-2 font-mono text-sm text-violet">{site.authorRole}</p>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">{site.siteDescription}</p>
    </section>
  );
}

import Link from "next/link";
import { figureNames } from "@/lib/content/directives";
import { plural } from "@/lib/format";
import { getLatestPosts } from "@/lib/issues";
import { getSeriesContext, getSeriesList } from "@/lib/series";
import { getSiteSettings } from "@/lib/settings";
import { readingMinutes } from "@/lib/tags";
import type { SearchParams, TenantPage } from "../../types";
import { FigureSlot, hasMiniFigure } from "../components/FigureSlot";
import { Icon } from "../components/Icon";
import { NewsletterForm } from "../components/NewsletterForm";
import { SeriesList } from "../components/SeriesList";
import { config } from "../config";
import { shortDate } from "../lib/dates";
import { articleIcon } from "../lib/icons";
import { inlineCode, plainText } from "../lib/inline";
import { alternates } from "../lib/seo";
import { copy, messages } from "../messages";
import { ArticleCard } from "../slots/ArticleCard";
import { HomeHero } from "../slots/HomeHero";

const m = copy.home;

/** "Lo último" + la lista corta de artículos, como en la maqueta */
const HOME_POSTS = 7;

async function HomePage() {
  const [site, posts, seriesList] = await Promise.all([
    getSiteSettings(),
    getLatestPosts(HOME_POSTS),
    config.features.series ? getSeriesList() : Promise.resolve([]),
  ]);
  const [latest, ...rest] = posts;
  const context = latest ? await getSeriesContext(latest) : null;
  const latestFigures = latest ? figureNames(latest.content) : [];
  const latestMini = latestFigures.find(hasMiniFigure);
  const latestDate = latest ? (latest.publishedAt ?? latest.createdAt) : null;

  return (
    <div className="site">
      <div className="home col">
        <HomeHero site={site} />

        {!latest && (
          <section className="sec">
            <p className="muted">{messages.home.empty}</p>
          </section>
        )}

        {latest && latestDate && (
          <section className="sec" aria-labelledby="latest-h">
            <div className="sec-head">
              <h2 className="eyebrow" id="latest-h">
                {m.latest}
              </h2>
            </div>
            <article className="latest">
              <div className="latest-meta">
                <Icon name={articleIcon(latest)} />
                <div>
                  {context && (
                    <p className="eyebrow">
                      {context.series.title}
                      {` · ${copy.article.part} ${context.part} ${copy.article.of} ${context.total}`}
                    </p>
                  )}
                  <h3>
                    <Link href={`/articulo/${latest.slug}`}>{latest.title}</Link>
                  </h3>
                </div>
              </div>
              {latest.excerpt && <p className="lede">{inlineCode(latest.excerpt)}</p>}
              {latestMini && (
                <Link
                  className="latest-fig"
                  href={`/articulo/${latest.slug}`}
                  aria-label={`${m.read}${latest.title}`}
                >
                  <FigureSlot name={latestMini} variant="mini" />
                </Link>
              )}
              <p className="fig-note tnum">
                {shortDate(latestDate)}
                {` · ${readingMinutes(`${latest.excerpt} ${latest.content}`)} ${copy.article.min}`}
                {latestFigures.length > 0 &&
                  ` · ${latestFigures.length} ${plural(latestFigures.length, m.figures)}`}
              </p>
            </article>
          </section>
        )}

        {rest.length > 0 && (
          <section className="sec" aria-labelledby="posts-h">
            <div className="sec-head">
              <h2 className="t-h2" id="posts-h">
                {m.articles}
              </h2>
              {config.features.rss && <a href="/feed.xml">{m.rss}</a>}
            </div>
            <ul className="posts">
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} upvotes={0} commentCount={0} />
              ))}
            </ul>
          </section>
        )}

        {seriesList.length > 0 && (
          <section className="sec" aria-labelledby="series-h">
            <div className="sec-head">
              <h2 className="t-h2" id="series-h">
                {m.series}
              </h2>
            </div>
            <SeriesList items={seriesList} />
          </section>
        )}

        {config.features.newsletter && (
          <section className="sec" aria-label={copy.newsletter.section}>
            <NewsletterForm
              id="nl-home"
              lead={
                <>
                  <b>{copy.newsletter.homeStrong}</b>
                  {copy.newsletter.homeLead}
                </>
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}

export const homePage: TenantPage<{ searchParams: SearchParams }> = {
  Page: HomePage,
  metadata: async () => {
    const site = await getSiteSettings();
    return {
      title: { absolute: `${config.siteName} ${copy.brandSuffix} — ${site.authorName}` },
      description: plainText(site.siteDescription),
      alternates: alternates("/"),
    };
  },
};

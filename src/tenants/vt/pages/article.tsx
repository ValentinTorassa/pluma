import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getApprovedComments, getPublishedBySlug, getUpvoteCounts } from "@/lib/data";
import { getSeriesContext, type SeriesContext } from "@/lib/series";
import { getSiteSettings } from "@/lib/settings";
import { readingMinutes } from "@/lib/tags";
import type { TenantPage } from "../../types";
import { Avatar } from "../Avatar";
import { Comments } from "../components/Comments";
import { renderContent } from "../components/Content";
import { JsonLd } from "../components/JsonLd";
import { NewsletterForm } from "../components/NewsletterForm";
import { Toc } from "../components/Toc";
import { Upvote } from "../components/Upvote";
import { ViewBeacon } from "../components/ViewBeacon";
import { config } from "../config";
import { dayMonth, fromIsoDay, isoDate, shortDate } from "../lib/dates";
import { inlineCode } from "../lib/inline";
import { articleMetadata, blogPostingJsonLd } from "../lib/seo";
import { links } from "../links";
import { copy } from "../messages";

const m = copy.article;

function SeriesNav({ context }: { context: SeriesContext }) {
  const { prev, next } = context;
  if (!prev && !next) return null;

  return (
    <nav className="sernav" aria-label={`${m.seriesNav}${context.series.title}`}>
      {prev ? (
        <Link href={`/articulo/${prev.slug}`}>
          <span>{`← ${m.partCap} ${prev.seriesOrder ?? context.part - 1}`}</span>
          <strong>{prev.title}</strong>
        </Link>
      ) : null}
      {next && "article" in next && (
        <Link className="next" href={`/articulo/${next.article.slug}`}>
          <span>{`${m.partCap} ${next.article.seriesOrder ?? context.part + 1} →`}</span>
          <strong>{next.article.title}</strong>
        </Link>
      )}
      {next && "upcoming" in next && (
        <div className="next">
          <span>
            {`${m.partCap} ${next.upcoming.part}`}
            {next.upcoming.date && ` · ${m.comesOut} ${dayMonth(fromIsoDay(next.upcoming.date))}`}
            {" →"}
          </span>
          <strong>{next.upcoming.title}</strong>
        </div>
      )}
    </nav>
  );
}

async function ArticlePage({ slug }: { slug: string }) {
  const article = await getPublishedBySlug(slug);
  if (!article) notFound();
  // Un envío de Apuntes tiene su URL canónica en /apuntes/N
  if (config.features.apuntes && article.issueNumber != null) {
    permanentRedirect(`/apuntes/${article.issueNumber}`);
  }

  const [site, content, context, comments, upvoteCounts] = await Promise.all([
    getSiteSettings(),
    renderContent(article.content, { anchors: true }),
    config.features.series ? getSeriesContext(article) : Promise.resolve(null),
    getApprovedComments(article.id),
    getUpvoteCounts([article.id]),
  ]);
  const date = article.publishedAt ?? article.createdAt;
  const minutes = readingMinutes(`${article.excerpt} ${article.content}`);
  const upcoming = context?.next && "upcoming" in context.next ? context.next.upcoming : null;

  return (
    <div className="site">
      <article className="art">
        <header className="art-head">
          {context && (
            <p className="eyebrow">
              <Link href={`/serie/${context.series.slug}`}>{context.series.title}</Link>
              {` · ${m.part} ${context.part} ${m.of} ${context.total}`}
            </p>
          )}
          <h1 className="t-display">{article.title}</h1>
          {article.excerpt && <p className="lede">{inlineCode(article.excerpt)}</p>}
          <div className="byline">
            <Avatar />
            <span>
              <b>{site.authorName}</b>
              {" · "}
              <span className="tnum">
                <time dateTime={isoDate(date)}>{shortDate(date)}</time>
                {` · ${minutes} ${m.min}`}
              </span>
            </span>
          </div>
        </header>

        {content.headings.length >= 2 && (
          <>
            <Toc headings={content.headings} variant="side" />
            <Toc headings={content.headings} variant="inline" />
          </>
        )}

        <div className="art-body">{content.element}</div>

        {config.features.views && <ViewBeacon articleId={article.id} />}

        <Upvote articleId={article.id} initialCount={upvoteCounts.get(article.id) ?? 0} />

        <div className="author">
          <Avatar />
          <p>
            <b>{`${site.authorName}.`}</b>
            {` ${m.authorBefore}`}
            <a className="textlink" href={links.youtube}>
              {m.authorLink}
            </a>
            {m.authorAfter}
          </p>
        </div>

        {context && <SeriesNav context={context} />}

        <Comments articleId={article.id} comments={comments} />

        {config.features.newsletter && (
          <section className="sec" aria-label={copy.newsletter.section}>
            <NewsletterForm
              id="nl-art"
              lead={
                <>
                  <b>
                    {upcoming
                      ? `${m.partCap} ${upcoming.part}${copy.newsletter.partByMail}`
                      : copy.newsletter.nextByMail}
                  </b>
                  {copy.newsletter.articleLead}
                </>
              }
            />
          </section>
        )}
      </article>
      <JsonLd data={blogPostingJsonLd(article, site, `/articulo/${article.slug}`, context?.series)} />
    </div>
  );
}

export const articlePage: TenantPage<{ slug: string }> = {
  Page: ArticlePage,
  metadata: async ({ slug }): Promise<Metadata> => {
    const [article, site] = await Promise.all([getPublishedBySlug(slug), getSiteSettings()]);
    if (!article) return {};
    const path =
      config.features.apuntes && article.issueNumber != null
        ? `/apuntes/${article.issueNumber}`
        : `/articulo/${article.slug}`;
    return articleMetadata(article, site, path);
  },
};

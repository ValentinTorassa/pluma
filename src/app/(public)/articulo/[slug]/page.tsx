import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ArticleToc } from "@/components/ArticleToc";
import { ShareButtons } from "@/components/ShareButtons";
import { extractHeadings } from "@/lib/headings";
import { TagPill } from "@/components/TagPill";
import { UpvoteButton } from "@/components/UpvoteButton";
import {
  getApprovedComments,
  getPublishedBySlug,
  getRelatedArticles,
  getUpvoteCounts,
  parseTags,
} from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";
import { readingMinutes } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/articulo/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const [article, site] = await Promise.all([
    getPublishedBySlug(slug),
    getSiteSettings(),
  ]);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt || site.siteDescription,
    openGraph: {
      title: article.title,
      description: article.excerpt || site.siteDescription,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      authors: [site.authorName],
      images: [
        {
          url: `/api/og/${article.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function ArticlePage(props: PageProps<"/articulo/[slug]">) {
  const { slug } = await props.params;
  const article = await getPublishedBySlug(slug);
  if (!article) notFound();

  const tags = parseTags(article);
  const headings = extractHeadings(article.content);
  const minutes = readingMinutes(`${article.excerpt} ${article.content}`);
  const [upvoteCounts, comments, related] = await Promise.all([
    getUpvoteCounts([article.id]),
    getApprovedComments(article.id),
    getRelatedArticles(article.id, tags),
  ]);

  return (
    <article className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <header className="mb-10">
        <time className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {article.publishedAt &&
            new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(
              article.publishedAt,
            )}
          {article.publishedAt && " · "}
          {minutes} min de lectura
        </time>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-ink">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-4 border-l-2 border-accent/50 pl-4 text-lg italic text-muted leading-relaxed">
            {article.excerpt}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        )}
      </header>

      {article.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverImage}
          alt=""
          className="mb-10 aspect-[2/1] w-full rounded-2xl object-cover shadow-lg"
        />
      )}

      <ArticleToc headings={headings} />

      <div className="article-body">
        <MarkdownRenderer content={article.content} />
      </div>

      <div className="no-print mt-12 flex flex-col gap-4 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between">
        <UpvoteButton articleId={article.id} initialCount={upvoteCounts.get(article.id) ?? 0} />
        <ShareButtons
          title={article.title}
          url={`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/articulo/${article.slug}`}
        />
      </div>

      <section className="no-print mt-12">
        <h2 className="mb-6 font-serif text-2xl font-semibold">
          Comentarios ({comments.length})
        </h2>
        <CommentList comments={comments} articleId={article.id} />
        <div className="mt-8">
          <CommentForm articleId={article.id} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="no-print mt-16 border-t border-line pt-10">
          <h2 className="mb-6 font-serif text-2xl font-semibold">También te puede interesar</h2>
          <ul className="space-y-4">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/articulo/${r.slug}`}
                  className="group block rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-accent/40"
                >
                  <span className="font-serif text-lg font-semibold leading-snug group-hover:text-accent">
                    {r.title}
                  </span>
                  {r.excerpt && (
                    <p className="mt-1 text-sm text-muted line-clamp-2">{r.excerpt}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TagPill } from "@/components/TagPill";
import { UpvoteButton } from "@/components/UpvoteButton";
import {
  getApprovedComments,
  getPublishedBySlug,
  getUpvoteCounts,
  parseTags,
} from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";

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
      images: article.coverImage ? [article.coverImage] : [],
    },
  };
}

export default async function ArticlePage(props: PageProps<"/articulo/[slug]">) {
  const { slug } = await props.params;
  const article = await getPublishedBySlug(slug);
  if (!article) notFound();

  const [upvoteCounts, comments] = await Promise.all([
    getUpvoteCounts([article.id]),
    getApprovedComments(article.id),
  ]);
  const tags = parseTags(article);

  return (
    <article className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <header className="mb-10">
        <time className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {article.publishedAt &&
            new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(
              article.publishedAt,
            )}
        </time>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight">
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

      <MarkdownRenderer content={article.content} />

      <div className="mt-12 flex items-center justify-between border-y border-line py-6">
        <UpvoteButton articleId={article.id} initialCount={upvoteCounts.get(article.id) ?? 0} />
        <p className="text-sm text-muted">¿Te resultó útil este artículo?</p>
      </div>

      <section className="mt-12">
        <h2 className="mb-6 font-serif text-2xl font-semibold">
          Comentarios ({comments.length})
        </h2>
        <CommentList comments={comments} />
        <div className="mt-8">
          <CommentForm articleId={article.id} />
        </div>
      </section>
    </article>
  );
}

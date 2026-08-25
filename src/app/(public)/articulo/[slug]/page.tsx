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
import { config } from "@/pluma.config";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/articulo/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getPublishedBySlug(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt || config.siteDescription,
    openGraph: {
      title: article.title,
      description: article.excerpt || config.siteDescription,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      authors: [config.author.name],
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
    <article className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <time className="text-xs uppercase tracking-wider text-muted">
          {article.publishedAt &&
            new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(
              article.publishedAt,
            )}
        </time>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight tracking-tight">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-3 text-lg text-muted leading-relaxed">{article.excerpt}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
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
          className="mb-10 aspect-[2/1] w-full rounded-xl object-cover"
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

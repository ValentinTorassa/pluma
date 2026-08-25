import Link from "next/link";
import type { Article } from "@/db/schema";
import { parseTags } from "@/lib/data";
import { TagPill } from "./TagPill";

export function ArticleCard({
  article,
  upvotes,
  commentCount,
}: {
  article: Article;
  upvotes: number;
  commentCount: number;
}) {
  const tags = parseTags(article);
  const date = article.publishedAt
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(article.publishedAt)
    : "";

  return (
    <article className="group border-b border-line py-8 first:pt-0">
      <Link href={`/articulo/${article.slug}`} className="block">
        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            alt=""
            className="mb-5 aspect-[2/1] w-full rounded-xl object-cover"
          />
        )}
        <time className="text-xs uppercase tracking-wider text-muted">{date}</time>
        <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug group-hover:text-accent transition-colors">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="mt-2 text-muted leading-relaxed line-clamp-2">{article.excerpt}</p>
        )}
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted shrink-0">
          <span title="Votos">▲ {upvotes}</span>
          <span title="Comentarios">💬 {commentCount}</span>
        </div>
      </div>
    </article>
  );
}

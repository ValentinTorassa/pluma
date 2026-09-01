import Link from "next/link";
import type { Article } from "@/db/schema";
import { parseTags } from "@/lib/data";
import { readingMinutes } from "@/lib/tags";
import { relativeTime } from "@/lib/format";
import { Logo } from "./Logo";
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
  const ago = article.publishedAt ? relativeTime(article.publishedAt) : "";
  const minutes = readingMinutes(`${article.excerpt} ${article.content}`);

  return (
    <article className="group -mx-4 rounded-2xl px-4 py-8 transition-colors duration-300 first:pt-4 hover:bg-accent-soft/50 sm:-mx-6 sm:px-6">
      <Link href={`/articulo/${article.slug}`} className="block">
        <div className="mb-5 overflow-hidden rounded-xl">
          {article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.coverImage}
              alt=""
              className="aspect-[2/1] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex aspect-[2/1] items-center justify-center bg-accent-soft">
              <Logo className="h-16 w-16 rotate-12 text-accent/25" />
            </div>
          )}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted">
          <time dateTime={article.publishedAt?.toISOString()}>{ago}</time>
          {minutes > 0 && <> · {minutes} min de lectura</>}
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug transition-colors group-hover:text-accent">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="mt-2 text-muted leading-relaxed line-clamp-2">{article.excerpt}</p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
          Leer artículo
          <span
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </Link>
      <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm text-muted">
          <span title="Votos">▲ {upvotes}</span>
          <span title="Comentarios">💬 {commentCount}</span>
        </div>
      </div>
    </article>
  );
}

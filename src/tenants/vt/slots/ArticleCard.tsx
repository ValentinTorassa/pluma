import Link from "next/link";
import { TagPill } from "@/components/TagPill";
import { relativeTime } from "@/lib/format";
import { parseTags, readingMinutes } from "@/lib/tags";
import type { ArticleCardProps } from "../../types";
import { messages } from "../messages";

/** TODO(phase4): tarjeta definitiva (portada, serie, nivel, etc.). */
export function ArticleCard({ article, upvotes, commentCount }: ArticleCardProps) {
  const tags = parseTags(article);
  const minutes = readingMinutes(`${article.excerpt} ${article.content}`);

  return (
    <article className="mb-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent/50">
      <Link href={`/articulo/${article.slug}`} className="block">
        <p className="font-mono text-xs text-muted">
          <time dateTime={article.publishedAt?.toISOString()}>
            {article.publishedAt ? relativeTime(article.publishedAt) : ""}
          </time>
          {` · ${minutes} ${messages.card.minutesRead}`}
        </p>
        <h2 className="mt-2 font-serif text-xl font-semibold text-ink">{article.title}</h2>
        {article.excerpt && <p className="mt-2 line-clamp-2 text-muted">{article.excerpt}</p>}
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
        <div className="flex shrink-0 gap-4 font-mono text-xs text-muted">
          <span title={messages.card.votes}>▲ {upvotes}</span>
          <span title={messages.card.comments}># {commentCount}</span>
        </div>
      </div>
    </article>
  );
}

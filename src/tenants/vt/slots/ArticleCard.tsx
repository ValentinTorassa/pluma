import Link from "next/link";
import type { ArticleCardProps } from "../../types";
import { isoDate, shortDate } from "../lib/dates";
import { inlineCode } from "../lib/inline";

/** Fila de la lista de artículos: fecha a la izquierda, título y bajada */
export function ArticleCard({ article }: ArticleCardProps) {
  const date = article.publishedAt ?? article.createdAt;

  return (
    <li>
      <time className="tnum" dateTime={isoDate(date)}>
        {shortDate(date)}
      </time>
      <div>
        <Link href={`/articulo/${article.slug}`}>{article.title}</Link>
        {article.excerpt && <p>{inlineCode(article.excerpt)}</p>}
      </div>
    </li>
  );
}

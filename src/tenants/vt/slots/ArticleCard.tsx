import Link from "next/link";
import type { ArticleCardProps } from "../../types";
import { Icon } from "../components/Icon";
import { isoDate, shortDate } from "../lib/dates";
import { articleIcon } from "../lib/icons";
import { inlineCode } from "../lib/inline";

/** Fila de la lista de artículos: ícono, fecha, título y bajada */
export function ArticleCard({ article }: ArticleCardProps) {
  const date = article.publishedAt ?? article.createdAt;

  return (
    <li>
      <Icon name={articleIcon(article)} />
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

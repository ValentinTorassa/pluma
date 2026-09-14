import Link from "next/link";
import type { Series } from "@/db/schema";
import { copy } from "../messages";

export type SeriesListItem = { series: Series; published: number; total: number };

export function SeriesList({ items }: { items: SeriesListItem[] }) {
  return (
    <ul className="series-list">
      {items.map(({ series, published, total }) => (
        <li key={series.id}>
          <Link href={`/serie/${series.slug}`}>{series.title}</Link>
          <span className="tnum">
            {published}
            {` ${copy.article.of} `}
            {total}
            {` ${copy.series.published}`}
          </span>
          {series.summary && <p>{series.summary}</p>}
        </li>
      ))}
    </ul>
  );
}

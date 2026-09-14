import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { figureNames } from "@/lib/content/directives";
import { getSeriesBySlug, getSeriesList } from "@/lib/series";
import { readingMinutes } from "@/lib/tags";
import type { TenantPage } from "../../types";
import { FigureSlot } from "../components/FigureSlot";
import { SeriesList } from "../components/SeriesList";
import { dayMonth, fromIsoDay, shortDate } from "../lib/dates";
import { inlineCode, plainText } from "../lib/inline";
import { alternates } from "../lib/seo";
import { copy } from "../messages";

const m = copy.series;

async function SeriesIndexPage() {
  const items = await getSeriesList();
  return (
    <div className="site">
      <div className="col page">
        <p className="eyebrow">{m.indexEyebrow}</p>
        <h1 className="t-display">{m.indexTitle}</h1>
        <p className="lede">{m.indexLede}</p>
        {items.length === 0 ? (
          <p className="fig-note">{m.empty}</p>
        ) : (
          <SeriesList items={items} />
        )}
      </div>
    </div>
  );
}

export const seriesIndexPage: TenantPage<Record<string, never>> = {
  Page: SeriesIndexPage,
  metadata: async () => ({
    title: m.indexTitle,
    description: m.indexLede,
    alternates: alternates("/series"),
  }),
};

async function SeriesPage({ slug }: { slug: string }) {
  const detail = await getSeriesBySlug(slug);
  if (!detail) notFound();
  const { series, parts, upcoming, facts, total } = detail;
  const latest = parts.at(-1);
  const latestFigure = latest ? figureNames(latest.content)[0] : undefined;
  const nextDate = upcoming.find((u) => u.date)?.date;

  return (
    <div className="site">
      <div className="col page">
        <p className="eyebrow">{`${m.eyebrow} · ${total} ${m.parts}`}</p>
        <h1 className="t-display">{series.title}</h1>
        {series.description && <p className="lede">{series.description}</p>}
        <p className="fig-note tnum">
          {`${parts.length} ${copy.article.of} ${total} ${m.published}`}
          {nextDate && ` · ${m.nextOut} ${dayMonth(fromIsoDay(nextDate))}`}
        </p>

        <ol className="parts">
          {parts.map((part, i) => {
            const open = part === latest && latestFigure;
            const date = part.publishedAt ?? part.createdAt;
            return (
              <li key={part.id} className={open ? "part part-open" : "part"}>
                <span className="part-n">{part.seriesOrder ?? i + 1}</span>
                <div className="part-body">
                  <h2>
                    <Link href={`/articulo/${part.slug}`}>{part.title}</Link>
                  </h2>
                  {part.excerpt && <p>{inlineCode(part.excerpt)}</p>}
                  {open && <FigureSlot name={latestFigure} variant="inline" />}
                  <p className="meta tnum">
                    {`${shortDate(date)} · ${readingMinutes(`${part.excerpt} ${part.content}`)} ${copy.article.min}`}
                  </p>
                </div>
              </li>
            );
          })}
          {upcoming.map((u) => (
            <li key={`u-${u.part}`} className="part upcoming">
              <span className="part-n">{u.part}</span>
              <div className="part-body">
                <h2>{u.title}</h2>
                {u.summary && <p>{inlineCode(u.summary)}</p>}
                {u.date && <p className="meta tnum">{`${m.comesOut} ${dayMonth(fromIsoDay(u.date))}`}</p>}
              </div>
            </li>
          ))}
        </ol>

        {facts.length > 0 && (
          <div className="facts">
            {facts.map((f) => (
              <div key={f.title}>
                <h3>{f.title}</h3>
                <p>{inlineCode(f.body)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const seriesPage: TenantPage<{ slug: string }> = {
  Page: SeriesPage,
  metadata: async ({ slug }): Promise<Metadata> => {
    const detail = await getSeriesBySlug(slug);
    if (!detail) return {};
    return {
      title: detail.series.title,
      description: plainText(detail.series.description || detail.series.summary),
      alternates: alternates(`/serie/${detail.series.slug}`),
    };
  },
};

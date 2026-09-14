import "server-only";
import { and, asc, count, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, series, type Article, type Series } from "@/db/schema";

/** Parte anunciada que todavía no salió (columna JSON `series.upcoming`) */
export type UpcomingPart = { part: number; title: string; summary: string; date: string | null };
export type SeriesFact = { title: string; body: string };

function jsonArray(raw: string): Record<string, unknown>[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
  } catch {
    return [];
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseFacts(s: Series): SeriesFact[] {
  return jsonArray(s.facts)
    .map((f) => ({ title: str(f.title), body: str(f.body) }))
    .filter((f) => f.title && f.body);
}

function parseUpcoming(s: Series, publishedCount: number): UpcomingPart[] {
  return jsonArray(s.upcoming)
    .filter((u) => str(u.title))
    .map((u, i) => ({
      part: typeof u.part === "number" ? u.part : publishedCount + i + 1,
      title: str(u.title),
      summary: str(u.summary),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(u.date)) ? str(u.date) : null,
    }));
}

const published = eq(articles.status, "published");

async function load(s: Series) {
  const parts = await db
    .select()
    .from(articles)
    .where(and(published, eq(articles.seriesId, s.id)))
    .orderBy(asc(articles.seriesOrder), asc(articles.publishedAt));
  const upcoming = parseUpcoming(s, parts.length);
  const total = Math.max(s.plannedParts ?? 0, parts.length + upcoming.length);
  return { series: s, parts, upcoming, facts: parseFacts(s), total };
}

export type SeriesDetail = Awaited<ReturnType<typeof load>>;

export async function getSeriesBySlug(slug: string): Promise<SeriesDetail | null> {
  const [s] = await db.select().from(series).where(eq(series.slug, slug));
  return s ? load(s) : null;
}

/** Todas las series con cuántas partes hay publicadas */
export async function getSeriesList() {
  const [rows, counts] = await Promise.all([
    db.select().from(series).orderBy(desc(series.createdAt)),
    db
      .select({ seriesId: articles.seriesId, total: count() })
      .from(articles)
      .where(and(published, isNotNull(articles.seriesId)))
      .groupBy(articles.seriesId),
  ]);
  const byId = new Map(counts.map((c) => [c.seriesId, c.total]));
  return rows.map((s) => {
    const publishedCount = byId.get(s.id) ?? 0;
    return {
      series: s,
      published: publishedCount,
      total: Math.max(s.plannedParts ?? 0, publishedCount),
    };
  });
}

export type SeriesContext = {
  series: Series;
  part: number;
  total: number;
  prev: Article | null;
  next: { article: Article } | { upcoming: UpcomingPart } | null;
};

/** Posición de un artículo en su serie, con la parte anterior y la siguiente */
export async function getSeriesContext(article: Article): Promise<SeriesContext | null> {
  if (!article.seriesId) return null;
  const [s] = await db.select().from(series).where(eq(series.id, article.seriesId));
  if (!s) return null;
  const detail = await load(s);
  const i = detail.parts.findIndex((p) => p.id === article.id);
  if (i === -1) return null;
  const nextArticle = detail.parts[i + 1];
  const isLast = i === detail.parts.length - 1;
  return {
    series: s,
    part: article.seriesOrder ?? i + 1,
    total: detail.total,
    prev: detail.parts[i - 1] ?? null,
    next: nextArticle
      ? { article: nextArticle }
      : isLast && detail.upcoming[0]
        ? { upcoming: detail.upcoming[0] }
        : null,
  };
}

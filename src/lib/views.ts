import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articleViewHits, articleViews, pageViewHits, pageViews } from "@/db/schema";
import type { PageKey } from "@/lib/page-key";

/**
 * Contador propio de visitas (feature `views`). Guarda un agregado por artículo
 * y día, no una fila por visita: lo que queda es consultable y chico.
 *
 * `article_view_hits` solo sirve para decidir si una visita es única en el día;
 * se puede podar sin tocar el histórico.
 */

/** YYYY-MM-DD en la zona del sitio (el servidor corre en UTC) */
export function siteDay(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function recordView(articleId: string, ipHash: string, day: string): Promise<void> {
  const inserted = await db
    .insert(articleViewHits)
    .values({ articleId, day, ipHash })
    .onConflictDoNothing()
    .returning({ articleId: articleViewHits.articleId });
  const isUnique = inserted.length > 0 ? 1 : 0;

  await db
    .insert(articleViews)
    .values({ articleId, day, views: 1, uniques: isUnique })
    .onConflictDoUpdate({
      target: [articleViews.articleId, articleViews.day],
      set: {
        views: sql`${articleViews.views} + 1`,
        uniques: sql`${articleViews.uniques} + ${isUnique}`,
      },
    });
}

/** Total histórico por artículo, para el admin o un export */
export async function getViewTotals(articleIds: string[]) {
  if (articleIds.length === 0) return new Map<string, { views: number; uniques: number }>();
  const rows = await db
    .select({
      articleId: articleViews.articleId,
      views: sql<number>`sum(${articleViews.views})`,
      uniques: sql<number>`sum(${articleViews.uniques})`,
    })
    .from(articleViews)
    .where(inArray(articleViews.articleId, articleIds))
    .groupBy(articleViews.articleId);
  return new Map(rows.map((r) => [r.articleId, { views: Number(r.views), uniques: Number(r.uniques) }]));
}

/** Serie diaria de un artículo, para graficar o exportar al Data Lab */
export async function getViewSeries(articleId: string) {
  return db
    .select({ day: articleViews.day, views: articleViews.views, uniques: articleViews.uniques })
    .from(articleViews)
    .where(eq(articleViews.articleId, articleId))
    .orderBy(articleViews.day);
}

/** Borra los hits de dedupe anteriores a `day`; el agregado no se toca */
export async function pruneViewHits(day: string) {
  return db.delete(articleViewHits).where(and(sql`${articleViewHits.day} < ${day}`));
}

/* ---------- Páginas que no son un artículo (home, /apuntes, /acerca…) ---------- */

/**
 * No propaga el error, como `consumeRateLimit`: el deploy puede llegar antes de
 * que la migración 0005 esté aplicada, y ahí cada visita a la home sería un 500
 * en los logs por una métrica. Cuando las tablas existen, empieza a contar.
 */
export async function recordPageView(page: PageKey, ipHash: string, day: string): Promise<void> {
  try {
    const inserted = await db
      .insert(pageViewHits)
      .values({ page, day, ipHash })
      .onConflictDoNothing()
      .returning({ page: pageViewHits.page });
    const isUnique = inserted.length > 0 ? 1 : 0;

    await db
      .insert(pageViews)
      .values({ page, day, views: 1, uniques: isUnique })
      .onConflictDoUpdate({
        target: [pageViews.page, pageViews.day],
        set: {
          views: sql`${pageViews.views} + 1`,
          uniques: sql`${pageViews.uniques} + ${isUnique}`,
        },
      });
  } catch (err) {
    console.error("[pluma] no se pudo contar la visita a la página, sigue de largo:", err);
  }
}

/** Total histórico por página, para el admin o un export */
export async function getPageViewTotals() {
  const rows = await db
    .select({
      page: pageViews.page,
      views: sql<number>`sum(${pageViews.views})`,
      uniques: sql<number>`sum(${pageViews.uniques})`,
    })
    .from(pageViews)
    .groupBy(pageViews.page);
  return new Map(rows.map((r) => [r.page, { views: Number(r.views), uniques: Number(r.uniques) }]));
}

/** Serie diaria de una página, para graficar o exportar al Data Lab */
export async function getPageViewSeries(page: PageKey) {
  return db
    .select({ day: pageViews.day, views: pageViews.views, uniques: pageViews.uniques })
    .from(pageViews)
    .where(eq(pageViews.page, page))
    .orderBy(pageViews.day);
}

/** Borra los hits de dedupe de páginas anteriores a `day`; el agregado no se toca */
export async function prunePageViewHits(day: string) {
  return db.delete(pageViewHits).where(and(sql`${pageViewHits.day} < ${day}`));
}

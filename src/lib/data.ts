import "server-only";
import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, comments, upvotes, type Article, type Comment } from "@/db/schema";
import { config } from "@/pluma.config";
import { parseTags } from "./tags";

export { parseTags };

/* ---------- Artículos públicos ---------- */

export async function getPublishedArticles(page = 1, tag?: string) {
  const limit = config.pageSize;
  const offset = (page - 1) * limit;
  const published = eq(articles.status, "published");
  const where = tag
    ? and(published, sql`${articles.tags} like ${`%"${tag.replace(/[^a-z0-9-]/gi, "")}"%`}`)
    : published;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(articles).where(where),
  ]);

  return { rows, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getRelatedArticles(articleId: string, tags: string[], limit = 3) {
  if (tags.length === 0) return [];
  const all = await db
    .select()
    .from(articles)
    .where(and(eq(articles.status, "published"), ne(articles.id, articleId)))
    .orderBy(desc(articles.publishedAt))
    .limit(40);

  return all
    .filter((a) => parseTags(a).some((t) => tags.includes(t)))
    .slice(0, limit);
}

export async function getArchiveMonths(): Promise<
  { year: number; month: number; count: number }[]
> {
  const rows = await db
    .select({ publishedAt: articles.publishedAt })
    .from(articles)
    .where(eq(articles.status, "published"));
  const map = new Map<string, { year: number; month: number; count: number }>();
  for (const r of rows) {
    if (!r.publishedAt) continue;
    const year = r.publishedAt.getFullYear();
    const month = r.publishedAt.getMonth() + 1;
    const key = `${year}-${month}`;
    const prev = map.get(key);
    map.set(key, { year, month, count: (prev?.count ?? 0) + 1 });
  }
  return [...map.values()].sort((a, b) =>
    a.year === b.year ? b.month - a.month : b.year - a.year,
  );
}

export async function getPublishedByMonth(year: number, month: number) {
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt));
  return rows.filter(
    (a) =>
      a.publishedAt?.getFullYear() === year &&
      a.publishedAt.getMonth() + 1 === month,
  );
}

export async function searchPublished(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt));
  return rows.filter((a) => {
    const tags = parseTags(a).join(" ");
    const hay = `${a.title} ${a.excerpt} ${a.content} ${tags}`.toLowerCase();
    return hay.includes(q);
  });
}

export async function getPublishedBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.status, "published")));
  return row ?? null;
}

export async function getAllTags(): Promise<string[]> {
  const rows = await db
    .select({ tags: articles.tags })
    .from(articles)
    .where(eq(articles.status, "published"));
  const set = new Set<string>();
  for (const r of rows) {
    try {
      for (const t of JSON.parse(r.tags) as string[]) set.add(t);
    } catch {
      /* ignorar */
    }
  }
  return [...set].sort();
}

/* ---------- Upvotes ---------- */

export async function getUpvoteCounts(articleIds: string[]) {
  if (articleIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ articleId: upvotes.articleId, total: count() })
    .from(upvotes)
    .where(inArray(upvotes.articleId, articleIds))
    .groupBy(upvotes.articleId);
  return new Map(rows.map((r) => [r.articleId, r.total]));
}

export async function hasUpvoted(articleId: string, ipHash: string) {
  const [row] = await db
    .select({ id: upvotes.id })
    .from(upvotes)
    .where(and(eq(upvotes.articleId, articleId), eq(upvotes.ipHash, ipHash)));
  return !!row;
}

/* ---------- Comentarios ---------- */

export async function getApprovedComments(articleId: string) {
  return db
    .select()
    .from(comments)
    .where(and(eq(comments.articleId, articleId), eq(comments.status, "approved")))
    .orderBy(comments.createdAt);
}

export async function getApprovedCommentCounts(articleIds: string[]) {
  if (articleIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ articleId: comments.articleId, total: count() })
    .from(comments)
    .where(and(inArray(comments.articleId, articleIds), eq(comments.status, "approved")))
    .groupBy(comments.articleId);
  return new Map(rows.map((r) => [r.articleId, r.total]));
}

/* ---------- Admin ---------- */

export async function getAllArticles() {
  return db.select().from(articles).orderBy(desc(articles.updatedAt));
}

export async function getArticleById(id: string) {
  const [row] = await db.select().from(articles).where(eq(articles.id, id));
  return row ?? null;
}

export async function getPendingComments(): Promise<(Comment & { articleTitle: string })[]> {
  const rows = await db
    .select({ comment: comments, articleTitle: articles.title })
    .from(comments)
    .innerJoin(articles, eq(comments.articleId, articles.id))
    .where(eq(comments.status, "pending"))
    .orderBy(desc(comments.createdAt));
  return rows.map((r) => ({ ...r.comment, articleTitle: r.articleTitle }));
}

export async function getPendingCommentCount() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(comments)
    .where(eq(comments.status, "pending"));
  return total;
}

/** Cantidad de comentarios recientes desde una IP (para rate limiting) */
export async function countRecentCommentsFromIp(ipHash: string, withinMinutes: number) {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  const [{ total }] = await db
    .select({ total: count() })
    .from(comments)
    .where(and(eq(comments.ipHash, ipHash), sql`${comments.createdAt} > ${since.getTime()}`));
  return total;
}

import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";

const published = eq(articles.status, "published");

/** Envíos de Apuntes publicados, del más nuevo al más viejo */
export async function getIssues() {
  return db
    .select()
    .from(articles)
    .where(and(published, isNotNull(articles.issueNumber)))
    .orderBy(desc(articles.issueNumber));
}

export async function getIssueByNumber(issueNumber: number) {
  const [row] = await db
    .select()
    .from(articles)
    .where(and(published, eq(articles.issueNumber, issueNumber)));
  return row ?? null;
}

/** Artículos publicados que no son envíos del newsletter (home) */
export async function getLatestPosts(limit: number) {
  return db
    .select()
    .from(articles)
    .where(and(published, isNull(articles.issueNumber)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/** Últimos publicados de cualquier tipo (RSS) */
export async function getFeedArticles(limit = 30) {
  return db
    .select()
    .from(articles)
    .where(published)
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

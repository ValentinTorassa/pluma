import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""),
  coverImage: text("cover_image"),
  /** JSON array de strings: '["forense","pericias"]' */
  tags: text("tags").notNull().default("[]"),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  /**
   * Serie a la que pertenece (feature `series`). Sin FK a propósito: en SQLite
   * agregar una columna con REFERENCES obliga a recrear la tabla, y la
   * migración tiene que ser aditiva.
   */
  seriesId: text("series_id"),
  /** Posición dentro de la serie (1, 2, 3…) */
  seriesOrder: integer("series_order"),
  /** Número de La Quincena si el artículo es un envío del newsletter (feature `quincena`) */
  issueNumber: integer("issue_number"),
}, (t) => [
  index("articles_series_idx").on(t.seriesId, t.seriesOrder),
  uniqueIndex("articles_issue_number_unique").on(t.issueNumber),
]);

/** Series de artículos (feature `series`). */
export const series = sqliteTable("series", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** Una línea para listados (home) */
  summary: text("summary").notNull().default(""),
  /** Bajada de la página de la serie */
  description: text("description").notNull().default(""),
  /** Cantidad de partes planeadas (null = abierta) */
  plannedParts: integer("planned_parts"),
  /** JSON: [{ "title": "Procesos…", "summary": "…", "date": "2026-09-16" }] partes que todavía no salieron */
  upcoming: text("upcoming").notNull().default("[]"),
  /** JSON: [{ "title": "Antes de empezar", "body": "…" }] */
  facts: text("facts").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const upvotes = sqliteTable(
  "upvotes",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    /** SHA-256(ip + IP_SALT) — nunca guardamos la IP en crudo */
    ipHash: text("ip_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("upvotes_article_ip_unique").on(t.articleId, t.ipHash)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    username: text("username").notNull(),
    content: text("content").notNull(),
    /** SHA-256(ip + IP_SALT) — para moderación y rate limiting */
    ipHash: text("ip_hash").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("comments_article_status_idx").on(t.articleId, t.status)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

/**
 * Contadores de rate limiting (ventana fija) compartidos entre instancias
 * serverless. `key` = "<acción>:<ipHash>"; `window_start` en ms epoch.
 */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Upvote = typeof upvotes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Setting = typeof settings.$inferSelect;

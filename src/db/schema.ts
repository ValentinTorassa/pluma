import { integer, primaryKey, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
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
  /** Número de Apuntes si el artículo es un envío del newsletter (feature `apuntes`) */
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

/**
 * Tokens de la API de publicación (/api/v1, feature `publicApi`). Solo se
 * guarda el SHA-256 del token: el valor se imprime una vez al crearlo
 * (scripts/create-api-token.mjs) y no se puede recuperar desde la base.
 */
export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  /** Para quién es (p. ej. "agente de borradores") */
  name: text("name").notNull(),
  /** SHA-256 (hex) del token completo */
  tokenHash: text("token_hash").notNull().unique(),
  /** JSON array de scopes: '["posts:write","posts:publish"]' (ver src/lib/api-tokens.ts) */
  scopes: text("scopes").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  /** Con fecha = revocado (el token deja de valer; la fila queda como registro) */
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Upvote = typeof upvotes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Series = typeof series.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;

/**
 * Contador propio de visitas, por artículo y por día (feature `views`).
 * Agregado: no guardamos una fila por visita ni la IP en crudo. `article_view_hits`
 * existe solo para no contar dos veces al mismo visitante en el mismo día, y se
 * puede podar sin perder el histórico de `article_views`.
 */
export const articleViews = sqliteTable(
  "article_views",
  {
    articleId: text("article_id").notNull(),
    /** YYYY-MM-DD en la zona horaria del sitio */
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
    uniques: integer("uniques").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.day] }), index("article_views_day_idx").on(t.day)],
);

export const articleViewHits = sqliteTable(
  "article_view_hits",
  {
    articleId: text("article_id").notNull(),
    day: text("day").notNull(),
    /** SHA-256(ip + IP_SALT), igual que en upvotes y rate_limits */
    ipHash: text("ip_hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.day, t.ipHash] })],
);

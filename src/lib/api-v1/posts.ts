import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { config } from "@tenant/config";
import { db } from "@/db";
import { articles, series, type Article, type NewArticle, type Series } from "@/db/schema";
import { hasScope, type ApiPrincipal } from "@/lib/api-tokens";
import {
  autoExcerpt,
  isPlainObject,
  parsePostInput,
  type FieldError,
} from "@/lib/post-input";
import { slugify } from "@/lib/slug";
import { parseTags } from "@/lib/tags";
import { newId } from "@/lib/utils";
import { apiError, uniqueViolation, type ApiMessages } from "./http";

/**
 * Artículos en /api/v1 (feature `publicApi`).
 *
 * Reglas (las mismas que el admin, más estrictas donde un agente podría pisar algo):
 * - Sin `status`, un artículo nuevo es borrador.
 * - `posts:publish` hace falta para publicar, despublicar o editar algo que ya
 *   está publicado. Con solo `posts:write` se trabaja sobre borradores.
 * - Un slug o número de Apuntes repetido es 409 (el admin agrega "-2" al
 *   slug; acá se prefiere avisar a crear un duplicado).
 */

type SeriesRef = Pick<Series, "id" | "slug" | "title">;

function inputOptions(partial: boolean) {
  return { partial, series: config.features.series, issues: config.features.apuntes };
}

function publicPath(article: Pick<Article, "slug" | "issueNumber">) {
  return config.features.apuntes && article.issueNumber != null
    ? `/apuntes/${article.issueNumber}`
    : `/articulo/${article.slug}`;
}

export function serializePost(article: Article, seriesRef: SeriesRef | null) {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    tags: parseTags(article),
    coverImage: article.coverImage,
    status: article.status,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    series: seriesRef ? { slug: seriesRef.slug, title: seriesRef.title } : null,
    seriesOrder: article.seriesOrder,
    issueNumber: article.issueNumber,
    /** Ruta pública (solo existe si está publicado) */
    path: publicPath(article),
  };
}

function invalid(m: ApiMessages, errors: FieldError[], message = m.invalidPayload) {
  return apiError(400, "invalid_payload", message, errors);
}

const seriesColumns = { id: series.id, slug: series.slug, title: series.title };

async function seriesById(id: string | null): Promise<SeriesRef | null> {
  if (!id) return null;
  const [row] = await db.select(seriesColumns).from(series).where(eq(series.id, id));
  return row ?? null;
}

async function seriesBySlug(slug: string): Promise<SeriesRef | null> {
  const [row] = await db.select(seriesColumns).from(series).where(eq(series.slug, slug));
  return row ?? null;
}

async function slugInUse(slug: string, exceptId?: string) {
  const [row] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(exceptId ? and(eq(articles.slug, slug), ne(articles.id, exceptId)) : eq(articles.slug, slug));
  return Boolean(row);
}

async function issueInUse(issueNumber: number, exceptId?: string) {
  const byNumber = eq(articles.issueNumber, issueNumber);
  const [row] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(exceptId ? and(byNumber, ne(articles.id, exceptId)) : byNumber);
  return Boolean(row);
}

function revalidatePost(article: Pick<Article, "slug" | "issueNumber">, seriesRef: SeriesRef | null) {
  revalidatePath("/");
  revalidatePath("/archivo");
  revalidatePath(`/articulo/${article.slug}`);
  if (article.issueNumber != null) {
    revalidatePath("/apuntes");
    revalidatePath(`/apuntes/${article.issueNumber}`);
  }
  if (seriesRef) {
    revalidatePath("/series");
    revalidatePath(`/serie/${seriesRef.slug}`);
  }
}

/** Carrera entre el chequeo y el insert/update: el índice UNIQUE tiene la última palabra */
function conflictOrThrow(err: unknown, m: ApiMessages): Response {
  const column = uniqueViolation(err);
  if (column === "articles.slug") return apiError(409, "conflict", m.slugTaken);
  if (column === "articles.issue_number") return apiError(409, "conflict", m.issueNumberTaken);
  throw err;
}

/** POST /api/v1/posts */
export async function createPost(body: unknown, principal: ApiPrincipal, m: ApiMessages): Promise<Response> {
  const parsed = parsePostInput(body, inputOptions(false));
  if (!parsed.ok) return invalid(m, parsed.errors);
  const input = parsed.value;

  const status = input.status ?? "draft";
  if (status === "published" && !hasScope(principal.scopes, "posts:publish")) {
    return apiError(403, "forbidden", m.publishForbidden);
  }
  const content = input.content ?? "";
  if (status === "published" && !content) {
    return invalid(m, [{ field: "content", code: "required" }], m.publishWithoutContent);
  }

  const title = input.title ?? "";
  const slug = input.slug ?? slugify(title);
  if (!slug) return invalid(m, [{ field: "slug", code: "invalid" }]);

  let seriesRef: SeriesRef | null = null;
  if (input.series) {
    seriesRef = await seriesBySlug(input.series);
    if (!seriesRef) return invalid(m, [{ field: "series", code: "invalid" }], m.seriesNotFound);
  }
  if (input.seriesOrder != null && !seriesRef) {
    return invalid(m, [{ field: "seriesOrder", code: "invalid" }]);
  }

  if (await slugInUse(slug)) return apiError(409, "conflict", m.slugTaken);
  if (input.issueNumber != null && (await issueInUse(input.issueNumber))) {
    return apiError(409, "conflict", m.issueNumberTaken);
  }

  const now = new Date();
  const row = {
    id: newId(),
    title,
    slug,
    excerpt: status === "published" && !input.excerpt ? autoExcerpt(content) : (input.excerpt ?? ""),
    content,
    coverImage: input.coverImage ?? null,
    tags: JSON.stringify(input.tags ?? []),
    status,
    publishedAt: status === "published" ? now : null,
    createdAt: now,
    updatedAt: now,
    seriesId: seriesRef?.id ?? null,
    seriesOrder: seriesRef ? (input.seriesOrder ?? null) : null,
    issueNumber: input.issueNumber ?? null,
  } satisfies NewArticle;

  try {
    await db.insert(articles).values(row);
  } catch (err) {
    return conflictOrThrow(err, m);
  }

  revalidatePost(row, seriesRef);
  return Response.json({ ok: true, post: serializePost(row, seriesRef) }, { status: 201 });
}

/**
 * PATCH /api/v1/posts - `id` identifica el artículo (y entonces `slug` lo
 * renombra); sin `id`, lo identifica `slug`. Solo cambian los campos enviados.
 */
export async function updatePost(body: unknown, principal: ApiPrincipal, m: ApiMessages): Promise<Response> {
  if (!isPlainObject(body)) return invalid(m, [{ field: "body", code: "type" }]);
  const { id, ...fields } = body;

  let target: Article | undefined;
  if (id !== undefined) {
    if (typeof id !== "string" || !id) return invalid(m, [{ field: "id", code: "type" }]);
    [target] = await db.select().from(articles).where(eq(articles.id, id));
  } else {
    const slug = fields.slug;
    if (typeof slug !== "string" || !slug.trim()) return invalid(m, [{ field: "id", code: "required" }]);
    [target] = await db.select().from(articles).where(eq(articles.slug, slug.trim()));
    // Identifica, no renombra
    delete fields.slug;
  }

  const parsed = parsePostInput(fields, inputOptions(true));
  if (!parsed.ok) return invalid(m, parsed.errors);
  if (!target) return apiError(404, "not_found", m.notFound);
  const input = parsed.value;

  const status = input.status ?? target.status;
  if ((target.status === "published" || status === "published") && !hasScope(principal.scopes, "posts:publish")) {
    return apiError(403, "forbidden", m.publishForbidden);
  }
  const content = input.content ?? target.content;
  if (status === "published" && !content) {
    return invalid(m, [{ field: "content", code: "required" }], m.publishWithoutContent);
  }

  const slug = input.slug ?? target.slug;
  if (slug !== target.slug && (await slugInUse(slug, target.id))) {
    return apiError(409, "conflict", m.slugTaken);
  }

  let seriesRef: SeriesRef | null;
  if (input.series === undefined) {
    seriesRef = await seriesById(target.seriesId);
  } else if (input.series === null) {
    seriesRef = null;
  } else {
    seriesRef = await seriesBySlug(input.series);
    if (!seriesRef) return invalid(m, [{ field: "series", code: "invalid" }], m.seriesNotFound);
  }
  // Una serie que ya no existe (series_id sin FK) se trata como "sin serie"
  const seriesId = input.series === undefined && !seriesRef ? target.seriesId : (seriesRef?.id ?? null);
  const seriesOrder = input.seriesOrder !== undefined ? input.seriesOrder : input.series === null ? null : target.seriesOrder;
  if (input.seriesOrder != null && !seriesId) {
    return invalid(m, [{ field: "seriesOrder", code: "invalid" }]);
  }

  const issueNumber = input.issueNumber !== undefined ? input.issueNumber : target.issueNumber;
  if (issueNumber != null && issueNumber !== target.issueNumber && (await issueInUse(issueNumber, target.id))) {
    return apiError(409, "conflict", m.issueNumberTaken);
  }

  let excerpt = input.excerpt ?? target.excerpt;
  if (status === "published" && !excerpt) excerpt = autoExcerpt(content);

  const now = new Date();
  const changes = {
    title: input.title ?? target.title,
    slug,
    excerpt,
    content,
    coverImage: input.coverImage !== undefined ? input.coverImage : target.coverImage,
    tags: input.tags ? JSON.stringify(input.tags) : target.tags,
    status,
    publishedAt: status === "published" ? (target.publishedAt ?? now) : target.publishedAt,
    updatedAt: now,
    seriesId,
    seriesOrder: seriesId ? seriesOrder : null,
    issueNumber,
  } satisfies Partial<NewArticle>;

  try {
    await db.update(articles).set(changes).where(eq(articles.id, target.id));
  } catch (err) {
    return conflictOrThrow(err, m);
  }

  const updated: Article = { ...target, ...changes };
  revalidatePost(updated, seriesRef);
  if (target.slug !== slug || target.issueNumber !== issueNumber) revalidatePost(target, null);
  return Response.json({ ok: true, post: serializePost(updated, seriesRef) });
}

/** GET /api/v1/posts/[slug] - cualquier estado (los borradores también) */
export async function getPost(slug: string, m: ApiMessages): Promise<Response> {
  const [article] = await db.select().from(articles).where(eq(articles.slug, slug));
  if (!article) return apiError(404, "not_found", m.notFound);
  return Response.json({ ok: true, post: serializePost(article, await seriesById(article.seriesId)) });
}

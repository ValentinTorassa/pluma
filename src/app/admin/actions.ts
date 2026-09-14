"use server";

import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { articles, comments, series, settings, type NewArticle } from "@/db/schema";
import {
  checkCredentials,
  createSession,
  destroySession,
  isAuthenticated,
} from "@/lib/auth";
import { LIMITS, autoExcerpt, parseIntField, parseSeriesInput } from "@/lib/post-input";
import { RULES, consumeRateLimit, isRateLimited, resetRateLimit } from "@/lib/rate-limit";
import { getClientIpHash, newId, slugify } from "@/lib/utils";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { publishing } from "@tenant/publishing";

const e = messages.errors;

/* ---------- Auth ---------- */

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  // Rate limit de intentos fallidos por IP. Si falta IP_SALT no hay hash:
  // se loguea (en getClientIpHash) y se sigue sin limitar, para no dejar
  // a la autora afuera.
  const ipHash = await getClientIpHash();
  const limitKey = ipHash ? `login:${ipHash}` : null;
  if (limitKey && (await isRateLimited(db, limitKey, RULES.login))) {
    return { error: e.tooManyLogins };
  }

  if (!checkCredentials(username, password)) {
    if (limitKey) await consumeRateLimit(db, limitKey, RULES.login);
    return { error: e.badCredentials };
  }

  if (limitKey) await resetRateLimit(db, limitKey);
  await createSession(username);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/* ---------- Artículos ---------- */

async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "articulo";
  let candidate = root;
  let i = 2;
  for (;;) {
    const [row] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate));
    if (!row || row.id === excludeId) return candidate;
    candidate = `${root}-${i++}`;
  }
}

export async function saveArticle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  const id = String(formData.get("id") ?? "") || newId();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  let excerpt = String(formData.get("excerpt") ?? "").trim();
  const coverImage = String(formData.get("coverImage") ?? "").trim() || null;
  const status = formData.get("status") === "published" ? "published" : "draft";
  const tags = JSON.stringify(
    String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10),
  );

  if (!title) return { error: e.titleRequired };
  if (status === "published" && !content) {
    return { error: e.publishWithoutContent };
  }
  if (status === "published" && !excerpt) {
    excerpt = autoExcerpt(content);
  }

  const extra = await readPublishingFields(formData, id);
  if ("error" in extra) return extra;

  const requestedSlug = String(formData.get("slug") ?? "").trim();
  const slug = await uniqueSlug(slugify(requestedSlug || title), id);

  const existing = await db
    .select({ id: articles.id, status: articles.status, publishedAt: articles.publishedAt })
    .from(articles)
    .where(eq(articles.id, id));
  const prev = existing[0];

  const now = new Date();
  const publishedAt =
    status === "published" ? (prev?.publishedAt ?? now) : prev?.publishedAt ?? null;

  if (prev) {
    await db
      .update(articles)
      .set({ title, slug, excerpt, content, coverImage, tags, status, publishedAt, updatedAt: now, ...extra })
      .where(eq(articles.id, id));
  } else {
    await db.insert(articles).values({
      id,
      title,
      slug,
      excerpt,
      content,
      coverImage,
      tags,
      status,
      publishedAt,
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
  }

  revalidatePath("/");
  revalidatePath("/archivo");
  revalidatePath(`/articulo/${slug}`);
  redirect("/admin");
}

/**
 * Serie, parte y número de Apuntes del editor (ver components/admin/ArticlePublishingFields).
 * Solo se leen si el tenant tiene `publishing`, la feature y el form trae el
 * campo: en yanina devuelve `{}` y el guardado queda igual que siempre.
 */
async function readPublishingFields(
  formData: FormData,
  articleId: string,
): Promise<Pick<NewArticle, "seriesId" | "seriesOrder" | "issueNumber"> | { error: string }> {
  if (!publishing) return {};
  const pe = publishing.messages.errors;
  const fields: Pick<NewArticle, "seriesId" | "seriesOrder" | "issueNumber"> = {};

  if (config.features.series && formData.has("seriesId")) {
    const seriesId = String(formData.get("seriesId") ?? "") || null;
    const order = parseIntField(formData.get("seriesOrder"), LIMITS.seriesOrder);
    if (!order.ok) return { error: pe.seriesOrderInvalid };
    if (seriesId) {
      const [row] = await db.select({ id: series.id }).from(series).where(eq(series.id, seriesId));
      if (!row) return { error: pe.seriesNotFound };
    }
    fields.seriesId = seriesId;
    fields.seriesOrder = seriesId ? order.value : null;
  }

  if (config.features.apuntes && formData.has("issueNumber")) {
    const issue = parseIntField(formData.get("issueNumber"), LIMITS.issueNumber);
    if (!issue.ok) return { error: pe.issueNumberInvalid };
    if (issue.value !== null) {
      const [taken] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(and(eq(articles.issueNumber, issue.value), ne(articles.id, articleId)));
      if (taken) return { error: pe.issueNumberTaken };
    }
    fields.issueNumber = issue.value;
  }

  return fields;
}

/** Vista previa del editor con el pipeline del tenant (mismo render que el artículo público) */
export async function previewContent(markdown: string): Promise<ReactNode> {
  await requireAuth();
  if (!publishing) return null;
  return publishing.renderPreview(String(markdown).slice(0, LIMITS.content));
}

export async function deleteArticle(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  await db.delete(articles).where(eq(articles.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function toggleArticleStatus(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const [article] = await db
    .select({ status: articles.status, publishedAt: articles.publishedAt })
    .from(articles)
    .where(eq(articles.id, id));
  if (!article) return;

  const status = article.status === "published" ? "draft" : "published";
  await db
    .update(articles)
    .set({
      status,
      publishedAt: status === "published" ? (article.publishedAt ?? new Date()) : article.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id));

  revalidatePath("/");
  revalidatePath("/admin");
}

/* ---------- Comentarios ---------- */

export async function moderateComment(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");

  if (action === "approve") {
    await db.update(comments).set({ status: "approved" }).where(eq(comments.id, id));
  } else if (action === "reject") {
    await db.update(comments).set({ status: "rejected" }).where(eq(comments.id, id));
  } else if (action === "delete") {
    await db.delete(comments).where(eq(comments.id, id));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/comentarios");
}

/* ---------- Series (feature `series`, tenants con `publishing`) ---------- */

async function uniqueSeriesSlug(base: string, excludeId: string): Promise<string> {
  const root = base || "serie";
  let candidate = root;
  let i = 2;
  for (;;) {
    const [row] = await db.select({ id: series.id }).from(series).where(eq(series.slug, candidate));
    if (!row || row.id === excludeId) return candidate;
    candidate = `${root}-${i++}`;
  }
}

export async function saveSeries(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  if (!config.features.series || !publishing) redirect("/admin");
  const pe = publishing.messages.errors;

  const id = String(formData.get("id") ?? "") || newId();
  const parsed = parseSeriesInput({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    summary: String(formData.get("summary") ?? ""),
    description: String(formData.get("description") ?? ""),
    plannedParts: String(formData.get("plannedParts") ?? ""),
  });
  if (!parsed.ok) {
    const [first] = parsed.errors;
    if (first.field === "title" && first.code === "required") return { error: pe.seriesTitleRequired };
    if (first.field === "plannedParts") return { error: pe.plannedPartsInvalid };
    return { error: pe.seriesInvalid };
  }
  const input = parsed.value;
  const slug = await uniqueSeriesSlug(input.slug ?? slugify(input.title), id);
  const values = {
    title: input.title,
    slug,
    summary: input.summary ?? "",
    description: input.description ?? "",
    plannedParts: input.plannedParts ?? null,
  };

  const [prev] = await db.select({ slug: series.slug }).from(series).where(eq(series.id, id));
  if (prev) {
    await db.update(series).set(values).where(eq(series.id, id));
    if (prev.slug !== slug) revalidatePath(`/serie/${prev.slug}`);
  } else {
    await db.insert(series).values({ id, ...values });
  }

  revalidatePath("/");
  revalidatePath("/series");
  revalidatePath(`/serie/${slug}`);
  redirect("/admin/series");
}

/** Solo series sin artículos: `articles.series_id` no tiene FK y quedaría apuntando a la nada */
export async function deleteSeries(formData: FormData) {
  await requireAuth();
  if (!config.features.series) return;
  const id = String(formData.get("id") ?? "");
  const [used] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.seriesId, id))
    .limit(1);
  if (used) return;
  await db.delete(series).where(eq(series.id, id));
  revalidatePath("/series");
  revalidatePath("/admin/series");
}

/* ---------- Configuración del sitio ---------- */

const SETTING_FIELDS = [
  "authorName",
  "authorRole",
  "siteDescription",
  "authorBio",
  "authorEmail",
  "authorLinkedin",
  "authorAvatar",
] as const;

const FIELD_TO_KEY: Record<(typeof SETTING_FIELDS)[number], string> = {
  authorName: "author.name",
  authorRole: "author.role",
  siteDescription: "site.description",
  authorBio: "author.bio",
  authorEmail: "author.email",
  authorLinkedin: "author.linkedin",
  authorAvatar: "author.avatar",
};

export async function saveSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();

  for (const field of SETTING_FIELDS) {
    const value = String(formData.get(field) ?? "").trim();
    const key = FIELD_TO_KEY[field];
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  revalidatePath("/", "layout");
  return { saved: true };
}

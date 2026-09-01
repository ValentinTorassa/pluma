"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, comments, settings } from "@/db/schema";
import {
  checkCredentials,
  createSession,
  destroySession,
  isAuthenticated,
} from "@/lib/auth";
import { newId, slugify } from "@/lib/utils";

/* ---------- Auth ---------- */

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!checkCredentials(username, password)) {
    return { error: "Usuario o contraseña incorrectos." };
  }

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

  if (!title) return { error: "El título es obligatorio." };
  if (status === "published" && !content) {
    return { error: "No se puede publicar un artículo sin contenido." };
  }
  if (status === "published" && !excerpt) {
    excerpt = autoExcerpt(content);
  }

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
      .set({ title, slug, excerpt, content, coverImage, tags, status, publishedAt, updatedAt: now })
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
    });
  }

  revalidatePath("/");
  revalidatePath("/archivo");
  revalidatePath(`/articulo/${slug}`);
  redirect("/admin");
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

/* ---------- Configuración del sitio ---------- */

function autoExcerpt(content: string): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`\[\]()#-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  const cut = plain.slice(0, 220);
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("¡"));
  return (last > 80 ? cut.slice(0, last + 1) : cut).trim();
}

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

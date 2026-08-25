import { NextRequest } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, upvotes } from "@/db/schema";
import { getClientIpHash, newId } from "@/lib/utils";

/** POST /api/upvote — alterna el voto anónimo (1 por IP, guardamos solo el hash) */
export async function POST(request: NextRequest) {
  let articleId: string;
  try {
    const body = await request.json();
    articleId = String(body.articleId ?? "");
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.status, "published")));
  if (!article) {
    return Response.json({ error: "Artículo no encontrado" }, { status: 404 });
  }

  const ipHash = await getClientIpHash();

  const [existing] = await db
    .select({ id: upvotes.id })
    .from(upvotes)
    .where(and(eq(upvotes.articleId, articleId), eq(upvotes.ipHash, ipHash)));

  let voted: boolean;
  if (existing) {
    await db.delete(upvotes).where(eq(upvotes.id, existing.id));
    voted = false;
  } else {
    await db.insert(upvotes).values({ id: newId(), articleId, ipHash });
    voted = true;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(upvotes)
    .where(eq(upvotes.articleId, articleId));

  return Response.json({ voted, count: total });
}

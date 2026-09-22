import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { pageKey } from "@/lib/page-key";
import { RULES, consumeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/utils";
import { recordPageView, recordView, siteDay } from "@/lib/views";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";

const m = messages.api;

export const dynamic = "force-dynamic";

/**
 * POST /api/view - suma una visita (feature `views`).
 *
 *   { articleId: "…" }      un artículo, contra `article_views`
 *   { page: "/apuntes/3" }  el resto del sitio, contra `page_views`
 *
 * Lo llama el navegador después de pintar, así los prefetch y la mayoría de los
 * bots no cuentan. Guarda un agregado por día; de la IP, solo su hash.
 */
export async function POST(request: NextRequest) {
  let articleId: string;
  let page: string;
  try {
    const body = await request.json();
    articleId = String(body.articleId ?? "");
    page = String(body.page ?? "");
  } catch {
    return Response.json({ error: m.invalidBody }, { status: 400 });
  }
  if (!articleId && !page) return Response.json({ error: m.invalidBody }, { status: 400 });

  // El pathname lo manda el cliente: solo cuentan las claves del conjunto
  // cerrado, y una que no esté no es un error (el sitio puede tener rutas que
  // no se miden).
  const key = articleId ? null : pageKey(page);
  if (!articleId && !key) return Response.json({ ok: true, counted: false });

  let id = "";
  if (articleId) {
    const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
    if (!article) return Response.json({ error: m.articleNotFound }, { status: 404 });
    id = article.id;
  }

  // Sin IP_SALT no hay hash y no se cuenta: la métrica nunca frena el sitio
  const ipHash = await getClientIpHash();
  if (!ipHash) return Response.json({ ok: true, counted: false });

  const { allowed } = await consumeRateLimit(db, `view:${ipHash}`, RULES.view);
  if (!allowed) return Response.json({ ok: true, counted: false });

  const day = siteDay(config.timeZone);
  if (key) await recordPageView(key, ipHash, day);
  else await recordView(id, ipHash, day);

  return Response.json({ ok: true, counted: true });
}

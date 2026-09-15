// Generado por next.config.ts desde src/feature-routes/api/view/route.ts (feature "views"). No editar.
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { RULES, consumeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/utils";
import { recordView, siteDay } from "@/lib/views";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";

const m = messages.api;

export const dynamic = "force-dynamic";

/**
 * POST /api/view — suma una visita al artículo (feature `views`).
 * Lo llama el navegador después de pintar, así los prefetch y la mayoría de los
 * bots no cuentan. Guarda un agregado por día; de la IP, solo su hash.
 */
export async function POST(request: NextRequest) {
  let articleId: string;
  try {
    const body = await request.json();
    articleId = String(body.articleId ?? "");
  } catch {
    return Response.json({ error: m.invalidBody }, { status: 400 });
  }
  if (!articleId) return Response.json({ error: m.invalidBody }, { status: 400 });

  const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article) return Response.json({ error: m.articleNotFound }, { status: 404 });

  // Sin IP_SALT no hay hash y no se cuenta: la métrica nunca frena el sitio
  const ipHash = await getClientIpHash();
  if (!ipHash) return Response.json({ ok: true, counted: false });

  const { allowed } = await consumeRateLimit(db, `view:${ipHash}`, RULES.view);
  if (!allowed) return Response.json({ ok: true, counted: false });

  await recordView(article.id, ipHash, siteDay(config.timeZone));
  return Response.json({ ok: true, counted: true });
}

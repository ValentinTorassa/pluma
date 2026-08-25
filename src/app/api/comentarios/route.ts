import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, comments } from "@/db/schema";
import { countRecentCommentsFromIp } from "@/lib/data";
import { getClientIpHash, newId } from "@/lib/utils";
import { config } from "@/pluma.config";

const RATE_LIMIT_MINUTES = 2;

/** POST /api/comentarios — crea un comentario anónimo (queda pendiente de aprobación) */
export async function POST(request: NextRequest) {
  let body: { articleId?: string; username?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, message: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const articleId = String(body.articleId ?? "");
  const username = String(body.username ?? "").trim().slice(0, 40);
  const content = String(body.content ?? "").trim().slice(0, 2000);

  if (username.length < 2 || content.length < 3) {
    return Response.json(
      { ok: false, message: "Completá tu nombre y un comentario válido." },
      { status: 400 },
    );
  }

  // Filtro básico anti-spam (blacklist configurable)
  const lower = content.toLowerCase();
  if (config.commentBlacklist.some((w) => lower.includes(w))) {
    return Response.json(
      { ok: false, message: "El comentario no puede contener enlaces." },
      { status: 400 },
    );
  }

  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.status, "published")));
  if (!article) {
    return Response.json(
      { ok: false, message: "Artículo no encontrado." },
      { status: 404 },
    );
  }

  const ipHash = await getClientIpHash();

  // Rate limit: 1 comentario cada RATE_LIMIT_MINUTES por IP
  const recent = await countRecentCommentsFromIp(ipHash, RATE_LIMIT_MINUTES);
  if (recent > 0) {
    return Response.json(
      {
        ok: false,
        message: `Esperá unos minutos antes de comentar de nuevo.`,
      },
      { status: 429 },
    );
  }

  await db.insert(comments).values({
    id: newId(),
    articleId,
    username,
    content,
    ipHash,
    status: "pending",
  });

  return Response.json({
    ok: true,
    message: "¡Gracias! Tu comentario se publicará una vez aprobado.",
  });
}

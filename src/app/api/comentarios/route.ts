import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, comments } from "@/db/schema";
import { isValidParent } from "@/lib/comment-parent";
import { countRecentCommentsFromIp } from "@/lib/data";
import { getClientIpHash, newId } from "@/lib/utils";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";

const RATE_LIMIT_MINUTES = 2;
const m = messages.api;

/** POST /api/comentarios - crea un comentario anónimo (queda pendiente de aprobación) */
export async function POST(request: NextRequest) {
  let body: { articleId?: string; username?: string; content?: string; parentId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, message: m.invalidRequest },
      { status: 400 },
    );
  }

  const articleId = String(body.articleId ?? "");
  const username = String(body.username ?? "").trim().slice(0, 40);
  const content = String(body.content ?? "").trim().slice(0, 2000);
  const parentId = String(body.parentId ?? "").trim() || null;

  if (username.length < 2 || content.length < 3) {
    return Response.json(
      { ok: false, message: m.commentInvalid },
      { status: 400 },
    );
  }

  // Filtro básico anti-spam (blacklist configurable)
  const lower = content.toLowerCase();
  if (config.commentBlacklist.some((w) => lower.includes(w))) {
    return Response.json(
      { ok: false, message: m.commentLinks },
      { status: 400 },
    );
  }

  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.status, "published")));
  if (!article) {
    return Response.json(
      { ok: false, message: m.articleNotFound },
      { status: 404 },
    );
  }

  if (parentId) {
    const [parent] = await db
      .select({ articleId: comments.articleId, status: comments.status })
      .from(comments)
      .where(eq(comments.id, parentId));
    if (!isValidParent(parent, articleId)) {
      return Response.json(
        { ok: false, message: m.replyInvalid },
        { status: 400 },
      );
    }
  }

  const ipHash = await getClientIpHash();
  if (!ipHash) {
    return Response.json(
      { ok: false, message: m.commentsUnavailable },
      { status: 503 },
    );
  }

  // Rate limit: 1 comentario cada RATE_LIMIT_MINUTES por IP
  const recent = await countRecentCommentsFromIp(ipHash, RATE_LIMIT_MINUTES);
  if (recent > 0) {
    return Response.json(
      { ok: false, message: m.commentTooSoon },
      { status: 429 },
    );
  }

  await db.insert(comments).values({
    id: newId(),
    articleId,
    parentId,
    username,
    content,
    ipHash,
    status: "pending",
  });

  return Response.json({
    ok: true,
    message: m.commentThanks,
  });
}

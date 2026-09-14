import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { readJson, withApiToken } from "@/lib/api-v1/http";
import { createPost, updatePost } from "@/lib/api-v1/posts";

export const dynamic = "force-dynamic";

/**
 * API de publicación para agentes (feature `publicApi`).
 * `Authorization: Bearer <token>` (scripts/create-api-token.mjs).
 *
 *   POST  /api/v1/posts  crea un artículo (borrador salvo `status: "published"`)
 *   PATCH /api/v1/posts  edita el de `id` (o `slug`); solo cambian los campos enviados
 */
export async function POST(request: NextRequest) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "posts:write", m, async (principal) => {
    const read = await readJson(request, m);
    return "response" in read ? read.response : createPost(read.body, principal, m);
  });
}

export async function PATCH(request: NextRequest) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "posts:write", m, async (principal) => {
    const read = await readJson(request, m);
    return "response" in read ? read.response : updatePost(read.body, principal, m);
  });
}

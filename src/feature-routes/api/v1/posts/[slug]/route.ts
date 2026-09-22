import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { apiError, readJson, withApiToken } from "@/lib/api-v1/http";
import { getPost, updatePost } from "@/lib/api-v1/posts";
import { isPlainObject } from "@/lib/post-input";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** GET /api/v1/posts/[slug] - artículo en cualquier estado (feature `publicApi`, scope posts:read) */
export async function GET(request: NextRequest, context: Context) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "posts:read", m, async () => getPost((await context.params).slug, m));
}

/**
 * PATCH /api/v1/posts/[slug] - alias de PATCH /api/v1/posts identificando el
 * artículo por la URL. El body no puede traer `id` ni `slug` (renombrar se hace
 * con PATCH /api/v1/posts y `id`), así la URL es la única identificación.
 */
export async function PATCH(request: NextRequest, context: Context) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "posts:write", m, async (principal) => {
    const read = await readJson(request, m);
    if ("response" in read) return read.response;
    const { body } = read;
    if (!isPlainObject(body)) {
      return apiError(400, "invalid_payload", m.invalidPayload, [{ field: "body", code: "type" }]);
    }
    const clash = ["id", "slug"].filter((key) => key in body);
    if (clash.length > 0) {
      return apiError(
        400,
        "invalid_payload",
        m.invalidPayload,
        clash.map((field) => ({ field, code: "unknown_field" as const })),
      );
    }
    return updatePost({ ...body, slug: (await context.params).slug }, principal, m);
  });
}

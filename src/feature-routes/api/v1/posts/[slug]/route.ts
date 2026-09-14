import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { withApiToken } from "@/lib/api-v1/http";
import { getPost } from "@/lib/api-v1/posts";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** GET /api/v1/posts/[slug] — artículo en cualquier estado (feature `publicApi`, scope posts:read) */
export async function GET(request: NextRequest, context: Context) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "posts:read", m, async () => getPost((await context.params).slug, m));
}

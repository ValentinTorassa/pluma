import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { readJson, withApiToken } from "@/lib/api-v1/http";
import { createSeries, listSeries } from "@/lib/api-v1/series";

export const dynamic = "force-dynamic";

/**
 * GET  /api/v1/series  lista las series (scope posts:read)
 * POST /api/v1/series  crea una serie (scope series:write)
 * Feature `publicApi`.
 */
export async function GET(request: NextRequest) {
  if (!config.features.publicApi || !publishing) notFound();
  return withApiToken(request, "posts:read", publishing.messages.api, () => listSeries());
}

export async function POST(request: NextRequest) {
  if (!config.features.publicApi || !publishing) notFound();
  const m = publishing.messages.api;
  return withApiToken(request, "series:write", m, async () => {
    const read = await readJson(request, m);
    return "response" in read ? read.response : createSeries(read.body, m);
  });
}

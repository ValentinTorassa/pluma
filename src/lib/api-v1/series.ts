import "server-only";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { series, type Series } from "@/db/schema";
import { parseSeriesInput } from "@/lib/post-input";
import { getSeriesList } from "@/lib/series";
import { slugify } from "@/lib/slug";
import { newId } from "@/lib/utils";
import { apiError, uniqueViolation, type ApiMessages } from "./http";

/** Series en /api/v1 (feature `publicApi`): el agente las lista para elegir `series` al crear un artículo. */

function serializeSeries(s: Series, publishedParts: number) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    description: s.description,
    plannedParts: s.plannedParts,
    publishedParts,
    createdAt: s.createdAt.toISOString(),
  };
}

/** GET /api/v1/series */
export async function listSeries(): Promise<Response> {
  const rows = await getSeriesList();
  return Response.json({ ok: true, series: rows.map((r) => serializeSeries(r.series, r.published)) });
}

/** POST /api/v1/series */
export async function createSeries(body: unknown, m: ApiMessages): Promise<Response> {
  const parsed = parseSeriesInput(body);
  if (!parsed.ok) return apiError(400, "invalid_payload", m.invalidPayload, parsed.errors);
  const input = parsed.value;

  const slug = input.slug ?? slugify(input.title);
  if (!slug) return apiError(400, "invalid_payload", m.invalidPayload, [{ field: "slug", code: "invalid" }]);
  const [taken] = await db.select({ id: series.id }).from(series).where(eq(series.slug, slug));
  if (taken) return apiError(409, "conflict", m.seriesSlugTaken);

  const row: Series = {
    id: newId(),
    slug,
    title: input.title,
    summary: input.summary ?? "",
    description: input.description ?? "",
    plannedParts: input.plannedParts ?? null,
    upcoming: "[]",
    facts: "[]",
    createdAt: new Date(),
  };
  try {
    await db.insert(series).values(row);
  } catch (err) {
    if (uniqueViolation(err) === "series.slug") return apiError(409, "conflict", m.seriesSlugTaken);
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/series");
  return Response.json({ ok: true, series: serializeSeries(row, 0) }, { status: 201 });
}

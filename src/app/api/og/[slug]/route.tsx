import { ImageResponse } from "next/og";
import { config } from "@tenant/config";
import { og } from "@tenant/og";
import { getPublishedBySlug } from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";

const OG_CDN_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const [article, site] = await Promise.all([
    getPublishedBySlug(slug),
    getSiteSettings(),
  ]);
  const title = article?.title ?? config.siteName;

  return new ImageResponse(og.article(title, site), {
    ...og.size,
    // Los crawlers de X, LinkedIn y otros piden la imagen de cada link que ven
    // y cada render es caro: un día en la CDN (un deploy nuevo la vacía).
    headers: { "Cache-Control": OG_CDN_CACHE },
  });
}

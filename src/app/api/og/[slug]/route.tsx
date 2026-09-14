import { ImageResponse } from "next/og";
import { config } from "@tenant/config";
import { og } from "@tenant/og";
import { getPublishedBySlug } from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";

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

  return new ImageResponse(og.article(title, site), { ...og.size });
}

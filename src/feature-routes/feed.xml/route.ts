import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { buildRss } from "@/lib/feed";
import { getFeedArticles } from "@/lib/issues";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /feed.xml — RSS 2.0 (feature `rss`) */
export async function GET() {
  if (!config.features.rss) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [rows, site] = await Promise.all([getFeedArticles(), getSiteSettings()]);

  const xml = buildRss({
    title: config.siteName,
    siteUrl,
    feedUrl: `${siteUrl}/feed.xml`,
    description: site.siteDescription,
    language: config.locale,
    items: rows.map((a) => ({
      title: a.title,
      url:
        config.features.quincena && a.issueNumber != null
          ? `${siteUrl}/quincena/${a.issueNumber}`
          : `${siteUrl}/articulo/${a.slug}`,
      description: a.excerpt,
      date: a.publishedAt ?? a.createdAt,
      author: site.authorName,
    })),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}

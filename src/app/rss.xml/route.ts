import { getPublishedArticles } from "@/lib/data";
import { parseTags } from "@/lib/data";
import { config } from "@/pluma.config";

export const dynamic = "force-dynamic";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { rows } = await getPublishedArticles(1);

  const items = rows
    .map((a) => {
      const url = `${siteUrl}/articulo/${a.slug}`;
      return `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(a.excerpt)}</description>
      ${a.publishedAt ? `<pubDate>${a.publishedAt.toUTCString()}</pubDate>` : ""}
      ${parseTags(a)
        .map((t) => `<category>${escapeXml(t)}</category>`)
        .join("\n      ")}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(config.siteName)} — ${escapeXml(config.author.name)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(config.siteDescription)}</description>
    <language>${config.locale}</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

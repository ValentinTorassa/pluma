import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { rows } = await getPublishedArticles(1);

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/acerca`, changeFrequency: "monthly", priority: 0.5 },
    ...rows.map((a) => ({
      url: `${siteUrl}/articulo/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

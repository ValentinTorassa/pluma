import type { MetadataRoute } from "next";
import { config } from "@tenant/config";
import { getPublishedSlugs } from "@/lib/data";
import { getIssues } from "@/lib/issues";
import { getSeriesList } from "@/lib/series";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const rows = await getPublishedSlugs();
  // Los envíos de Apuntes tienen URL canónica propia (/apuntes/N)
  const issues = config.features.apuntes ? await getIssues() : [];
  const issueSlugs = new Set(issues.map((i) => i.slug));
  const seriesList = config.features.series ? await getSeriesList() : [];

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/acerca`, changeFrequency: "monthly", priority: 0.5 },
    ...rows
      .filter((a) => !issueSlugs.has(a.slug))
      .map((a) => ({
        url: `${siteUrl}/articulo/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    ...(config.features.series
      ? [
          { url: `${siteUrl}/series`, changeFrequency: "weekly" as const, priority: 0.6 },
          ...seriesList.map((s) => ({
            url: `${siteUrl}/serie/${s.series.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          })),
        ]
      : []),
    ...(config.features.apuntes
      ? [
          { url: `${siteUrl}/apuntes`, changeFrequency: "weekly" as const, priority: 0.6 },
          ...issues.map((i) => ({
            url: `${siteUrl}/apuntes/${i.issueNumber}`,
            lastModified: i.updatedAt,
            changeFrequency: "yearly" as const,
            priority: 0.5,
          })),
        ]
      : []),
  ];
}

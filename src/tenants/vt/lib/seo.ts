import type { Metadata } from "next";
import type { Article, Series } from "@/db/schema";
import { ogLocale } from "@/lib/open-graph";
import type { SiteSettings } from "@/lib/settings";
import { config } from "../config";
import { organization, personRef, publisherRef } from "../identity";
import { plainText } from "./inline";

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * `alternates` de una página: canonical + el RSS. Next reemplaza (no mezcla)
 * el `alternates` del layout, así que el RSS se repite acá.
 */
export function alternates(path: string): Metadata["alternates"] {
  return {
    canonical: path,
    types: { "application/rss+xml": [{ url: "/feed.xml", title: config.siteName }] },
  };
}

export function articleMetadata(article: Article, site: SiteSettings, path: string): Metadata {
  const description = plainText(article.excerpt) || site.siteDescription;
  return {
    title: article.title,
    description,
    alternates: alternates(path),
    openGraph: {
      title: article.title,
      description,
      type: "article",
      siteName: config.siteName,
      locale: ogLocale(config.locale),
      url: path,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [site.authorName],
      images: [{ url: `/api/og/${article.slug}`, width: 1200, height: 630 }],
    },
  };
}

/**
 * JSON-LD BlogPosting (https://schema.org/BlogPosting). Autor y publisher son
 * las referencias compactas de la identidad compartida (identity.ts): el
 * registro completo de la persona está en valentorassa.com y el de la
 * organización, en el home.
 */
export function blogPostingJsonLd(
  article: Article,
  site: SiteSettings,
  path: string,
  series?: Series | null,
) {
  const base = siteUrl();
  const url = `${base}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: plainText(article.excerpt) || plainText(site.siteDescription),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    inLanguage: config.locale,
    image: `${base}/api/og/${article.slug}`,
    author: personRef,
    publisher: publisherRef,
    ...(series
      ? { isPartOf: { "@type": "CreativeWorkSeries", name: series.title, url: `${base}/serie/${series.slug}` } }
      : {}),
  };
}

/** JSON-LD de la organización (registro completo): solo en el home */
export function organizationJsonLd() {
  return { "@context": "https://schema.org", ...organization };
}

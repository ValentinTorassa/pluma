import { config } from "@tenant/config";
import type { Article } from "@/db/schema";

/** URL pública del sitio (la misma que usan el sitemap, los canonical y el RSS) */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Ruta canónica de un artículo publicado: un envío de Apuntes vive en /apuntes/N */
export function articlePath(article: Pick<Article, "slug" | "issueNumber">): string {
  return config.features.apuntes && article.issueNumber != null
    ? `/apuntes/${article.issueNumber}`
    : `/articulo/${article.slug}`;
}

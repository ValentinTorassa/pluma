/** Parsea el campo tags (JSON) de un artículo. Seguro para client y server. */
export function parseTags(article: { tags: string }): string[] {
  try {
    return JSON.parse(article.tags) as string[];
  } catch {
    return [];
  }
}

/** Parsea el campo tags (JSON) de un artículo. Seguro para client y server. */
export function parseTags(article: { tags: string }): string[] {
  try {
    return JSON.parse(article.tags) as string[];
  } catch {
    return [];
  }
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

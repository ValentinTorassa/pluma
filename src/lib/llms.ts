/**
 * Textos para agentes (puros, testeables): /llms.txt, /llms-full.txt y el
 * Markdown de cada artículo. Los arma src/lib/agents.ts con los datos de la base.
 *
 * Formato de /llms.txt: https://llmstxt.org (H1 con el nombre, resumen en
 * cita, secciones H2 con listas de enlaces "- [título](url): nota").
 */

export type LlmsLink = { title: string; url: string; description?: string };
export type LlmsSection = { title: string; links: LlmsLink[] };

export type ArticleDoc = {
  title: string;
  /** Bajada (Markdown en línea) */
  excerpt: string;
  /** URL canónica (absoluta) */
  url: string;
  author: string;
  lang: string;
  datePublished: Date;
  dateModified: Date;
  /** Cuerpo ya convertido a Markdown estándar (src/lib/content/to-markdown.ts) */
  body: string;
};

/** Una línea: los saltos de una bajada no pueden romper la lista */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function linkText(text: string): string {
  return oneLine(text).replace(/[[\]\\]/g, "\\$&");
}

function linkUrl(url: string): string {
  return url.replace(/[()\s<>]/g, (c) => encodeURIComponent(c));
}

function quote(text: string): string[] {
  const line = oneLine(text);
  return line ? [`> ${line}`, ""] : [];
}

export function buildLlmsTxt({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: LlmsSection[];
}): string {
  const lines = [`# ${oneLine(title)}`, "", ...quote(summary)];
  for (const section of sections) {
    if (section.links.length === 0) continue;
    lines.push(`## ${oneLine(section.title)}`, "");
    for (const link of section.links) {
      const note = link.description ? oneLine(link.description) : "";
      lines.push(`- [${linkText(link.title)}](${linkUrl(link.url)})${note ? `: ${note}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Front matter YAML: cada valor como string JSON (también es YAML válido) */
function frontMatter(fields: Record<string, string>): string[] {
  return ["---", ...Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`), "---", ""];
}

/** /articulo/<slug>.md: metadatos en front matter, título, bajada y cuerpo */
export function buildArticleMarkdown(doc: ArticleDoc): string {
  return [
    ...frontMatter({
      title: oneLine(doc.title),
      description: oneLine(doc.excerpt),
      canonical: doc.url,
      author: doc.author,
      lang: doc.lang,
      datePublished: doc.datePublished.toISOString(),
      dateModified: doc.dateModified.toISOString(),
    }),
    `# ${oneLine(doc.title)}`,
    "",
    ...quote(doc.excerpt),
    doc.body,
    "",
  ].join("\n");
}

/** /llms-full.txt: el sitio y después cada artículo entero, con su URL canónica en el título */
export function buildLlmsFull({
  title,
  summary,
  articles,
}: {
  title: string;
  summary: string;
  articles: Pick<ArticleDoc, "title" | "excerpt" | "url" | "body">[];
}): string {
  const lines = [`# ${oneLine(title)}`, "", ...quote(summary)];
  for (const a of articles) {
    lines.push("---", "", `# [${linkText(a.title)}](${linkUrl(a.url)})`, "", ...quote(a.excerpt), a.body, "");
  }
  return lines.join("\n");
}

import "server-only";
import { agents } from "@tenant/agents";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import type { Article } from "@/db/schema";
import { contentToMarkdown } from "./content/to-markdown";
import { getAllPublishedArticles, getPublishedBySlug } from "./data";
import { buildArticleMarkdown, buildLlmsFull, buildLlmsTxt, type LlmsSection } from "./llms";
import { articlePath, siteUrl } from "./paths";
import { getSiteSettings } from "./settings";

/**
 * Capa para agentes: /llms.txt, /llms-full.txt y /articulo/<slug>.md. Sale de
 * lo mismo que el sitio (artículos publicados de la base y el Markdown que
 * renderiza la página); los borradores no aparecen nunca.
 */

const absolute = (url: string) => (url.startsWith("/") ? `${siteUrl()}${url}` : url);

const isIssue = (a: Article) => config.features.apuntes && a.issueNumber != null;

function body(article: Article): string {
  return contentToMarkdown(article.content, { directives: config.features.callouts, figures: agents.figures });
}

export async function llmsTxt(): Promise<string> {
  const [rows, site] = await Promise.all([getAllPublishedArticles(), getSiteSettings()]);
  const link = (a: Article) => ({ title: a.title, url: absolute(articlePath(a)), description: a.excerpt });
  const sections: LlmsSection[] = [{ title: messages.nav.articles, links: rows.filter((a) => !isIssue(a)).map(link) }];
  if (agents.issuesTitle) sections.push({ title: agents.issuesTitle, links: rows.filter(isIssue).map(link) });
  if (agents.about) {
    sections.push({
      title: agents.about.title,
      links: agents.about.links.map((l) => ({ title: l.title, url: absolute(l.url) })),
    });
  }
  return buildLlmsTxt({ title: config.siteName, summary: site.siteDescription, sections });
}

export async function llmsFullTxt(): Promise<string> {
  const [rows, site] = await Promise.all([getAllPublishedArticles(), getSiteSettings()]);
  return buildLlmsFull({
    title: config.siteName,
    summary: site.siteDescription,
    articles: rows.map((a) => ({ title: a.title, excerpt: a.excerpt, url: absolute(articlePath(a)), body: body(a) })),
  });
}

/** Markdown de un artículo publicado, con su URL canónica; `null` si no existe o es borrador */
export async function articleMarkdown(slug: string): Promise<{ url: string; markdown: string } | null> {
  const [article, site] = await Promise.all([getPublishedBySlug(slug), getSiteSettings()]);
  if (!article) return null;
  const url = absolute(articlePath(article));
  return {
    url,
    markdown: buildArticleMarkdown({
      title: article.title,
      excerpt: article.excerpt,
      url,
      author: site.authorName,
      lang: config.locale,
      datePublished: article.publishedAt ?? article.createdAt,
      dateModified: article.updatedAt,
      body: body(article),
    }),
  };
}

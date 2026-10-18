import { messages } from "@tenant/messages";
import { articleMarkdown } from "@/lib/agents";

export const dynamic = "force-dynamic";

/**
 * GET /articulo/<slug>.md (rewrite en next.config.ts) - el artículo en
 * Markdown para agentes. El canonical sigue siendo la página HTML.
 */
export async function GET(_request: Request, context: RouteContext<"/articulo/[slug]/md">) {
  const { slug } = await context.params;
  const doc = await articleMarkdown(slug);
  if (!doc) {
    return new Response(messages.api.articleNotFound, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(doc.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${doc.url}>; rel="canonical"`,
    },
  });
}

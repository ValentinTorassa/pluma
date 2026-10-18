import { llmsTxt } from "@/lib/agents";

export const dynamic = "force-dynamic";

/** GET /llms.txt - índice del sitio para agentes (https://llmstxt.org) */
export async function GET() {
  return new Response(await llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

import { llmsFullTxt } from "@/lib/agents";

export const dynamic = "force-dynamic";

/** GET /llms-full.txt - todos los artículos publicados en Markdown, con su URL canónica */
export async function GET() {
  return new Response(await llmsFullTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

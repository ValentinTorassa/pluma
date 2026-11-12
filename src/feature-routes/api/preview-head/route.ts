import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { PREVIEW_CDN_CACHE, PREVIEW_USER_AGENT, previewDocument, previewTags } from "@/lib/preview-head";

/**
 * Las etiquetas de vista previa de la home en un documento sin cuerpo, para el
 * crawler de Meta (feature `previewBotHome`). La pide el proxy y la guarda la
 * CDN de Vercel un día, así que la home se renderiza para esto una vez por
 * región y día, no una vez por visita del crawler (src/lib/preview-head.ts).
 *
 * Sin etiquetas (la home falló o no trae og:title) responde 503 sin caché, y el
 * proxy sigue con el render normal.
 */
export async function GET(request: NextRequest) {
  if (!config.features.previewBotHome) notFound();
  let tags: string | null = null;
  try {
    const home = await fetch(new URL("/", request.url), {
      headers: { "user-agent": PREVIEW_USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (home.ok) tags = previewTags(await home.text());
  } catch {
    // sin etiquetas: 503
  }
  if (!tags) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  return new Response(previewDocument(tags, config.lang), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": PREVIEW_CDN_CACHE,
      // Es una copia del <head> de la home: que ningún buscador la indexe aparte
      "X-Robots-Tag": "noindex",
    },
  });
}

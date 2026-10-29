import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { readComandleSummary, recordComandleEvent } from "@/lib/comandle-daily";
import { COMANDLE_ORIGIN, comandleEvent, readCappedText } from "@/lib/comandle-event";
import { siteDay } from "@/lib/views";

/** En toda respuesta: el allow-origin fijo, y Vary para que ningún cache mezcle orígenes */
const CORS = { "Access-Control-Allow-Origin": COMANDLE_ORIGIN, Vary: "Origin" };

function reply(status: number): Response {
  return new Response(null, { status, headers: CORS });
}

/** Public, anonymous totals. Reading this endpoint never records a visit. */
export async function GET() {
  if (!config.features.comandleStats) notFound();
  const headers = { "Access-Control-Allow-Origin": "*" };
  try {
    const now = new Date();
    const summary = await readComandleSummary(siteDay(config.timeZone, now), config.timeZone, now);
    return Response.json(summary, {
      headers: { ...headers, "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  } catch {
    // An outage must not look like a day with zero games.
    return new Response(null, { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });
  }
}

/**
 * POST /api/comandle - suma un evento del juego comandle (feature
 * `comandleStats`; eventos y claves en src/lib/comandle-event.ts).
 *
 * El juego es un sitio estático en otro origen y avisa con
 * `fetch(url, { method: "POST", body: JSON.stringify({ event, key }),
 * credentials: "omit", keepalive: true, mode: "cors" })`: un pedido simple
 * de CORS, sin preflight, con el JSON como text/plain. Por eso el body se lee
 * como texto (hasta 512 bytes) y no se exige Content-Type. Va en modo `cors`
 * porque la página tiene `referrer: no-referrer`, y con esa política un POST
 * `no-cors` sale con `Origin: null` y acá daría 403.
 *
 * Solo cuenta si `Origin` es exactamente el del juego. 204 si se contó (o si
 * la tabla todavía no existe), 400 si el body o el evento no sirven, 403 por
 * origen. Sin cuerpo: el juego no lee la respuesta.
 *
 * Privacidad: no se guarda IP, ni su hash, ni user agent, ni ningún
 * identificador, y no pasa por `rate_limits` (que se indexa por hash de IP).
 * El precio es que cualquiera que mande el `Origin` a mano (curl, un script)
 * puede inflar los contadores, o sumar filas de `ref`/`from` inventados. Se
 * acepta: son números para orientarse, no para facturar.
 */
export async function POST(request: NextRequest) {
  if (!config.features.comandleStats) notFound();
  if (request.headers.get("origin") !== COMANDLE_ORIGIN) return reply(403);

  const raw = await readCappedText(request);
  if (raw === null) return reply(400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400);
  }
  const parsed = comandleEvent(body);
  if (!parsed) return reply(400);

  await recordComandleEvent(siteDay(config.timeZone), parsed.event, parsed.key);
  return reply(204);
}

/**
 * Preflight. El pedido simple no lo dispara, pero si el juego alguna vez
 * manda `Content-Type: application/json` en modo `cors`, el navegador pregunta
 * antes y esto lo deja pasar.
 */
export async function OPTIONS() {
  if (!config.features.comandleStats) notFound();
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

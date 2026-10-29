import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { isAuthenticated } from "@/lib/auth";
import { bookEvent, bookOrigin } from "@/lib/book-event";
import { recordBookClick } from "@/lib/book-clicks";
import { readCappedText } from "@/lib/comandle-event";
import { siteDay } from "@/lib/views";

export const dynamic = "force-dynamic";

function cors(origin: string | null): Record<string, string> {
  return { Vary: "Origin", "Cache-Control": "no-store", ...(origin ? { "Access-Control-Allow-Origin": origin } : {}) };
}

/**
 * JSON as text/plain, credentials omitted, following /api/comandle's simple CORS request.
 * Stores only a day/ref/event counter: 20 refs × 2 events, at most 40 rows per day.
 * No IP, hash, user agent, cookie, fingerprint or per-person deduplication is stored.
 * Origin protects browsers, not against forged requests; counts can be inflated.
 */
export async function POST(request: NextRequest) {
  if (!config.features.book) notFound();
  const origin = bookOrigin(request.headers.get("origin"));
  if (!origin) return new Response(null, { status: 403, headers: cors(null) });
  const raw = await readCappedText(request);
  if (raw === null) return new Response(null, { status: 400, headers: cors(origin) });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400, headers: cors(origin) }); }
  const parsed = bookEvent(body);
  if (!parsed) return new Response(null, { status: 400, headers: cors(origin) });
  // Applies when a same-origin caller has the admin session; cross-origin callers omit credentials.
  if (await isAuthenticated()) return Response.json({ ok: true, counted: false }, { headers: cors(origin) });
  const counted = await recordBookClick(siteDay(config.timeZone), parsed.event, parsed.ref);
  return Response.json({ ok: true, counted }, { headers: cors(origin) });
}

export async function OPTIONS(request: NextRequest) {
  if (!config.features.book) notFound();
  const origin = bookOrigin(request.headers.get("origin"));
  if (!origin) return new Response(null, { status: 403, headers: cors(null) });
  return new Response(null, {
    status: 204,
    headers: {
      ...cors(origin),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

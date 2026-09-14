import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { db } from "@/db";
import { consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/utils";

const m = messages.api;

/** Intentos de suscripción por IP */
const RULE = { limit: 5, windowMs: 60 * 60 * 1000 } satisfies RateLimitRule;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/newsletter — reenvía la suscripción al servicio de newsletter.
 *
 * El formulario postea acá (mismo origen: la CSP no permite form-action ni
 * connect-src externos) y el servidor llama a NEWSLETTER_SUBSCRIBE_URL
 * (endpoint público de listmonk: POST /api/public/subscription con
 * { email, list_uuids }). Sin la variable, responde 503 y el formulario se
 * muestra deshabilitado.
 */
export async function POST(request: NextRequest) {
  if (!config.features.newsletter) notFound();

  const endpoint = process.env.NEWSLETTER_SUBSCRIBE_URL;
  if (!endpoint) {
    return Response.json({ ok: false, message: m.newsletterUnavailable }, { status: 503 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: m.invalidRequest }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    return Response.json({ ok: false, message: m.newsletterInvalid }, { status: 400 });
  }

  const ipHash = await getClientIpHash();
  if (!ipHash) {
    return Response.json({ ok: false, message: m.newsletterUnavailable }, { status: 503 });
  }
  const { allowed } = await consumeRateLimit(db, `newsletter:${ipHash}`, RULE);
  if (!allowed) {
    return Response.json({ ok: false, message: m.newsletterTooMany }, { status: 429 });
  }

  // TODO(altcha): verificar acá la prueba de ALTCHA (campo `altcha` del form,
  // widget self-hosted, sin scripts de terceros) antes de reenviar.

  const listUuids = (process.env.NEWSLETTER_LIST_UUIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, list_uuids: listUuids }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error("[pluma] newsletter: no se pudo suscribir", err);
    return Response.json({ ok: false, message: m.newsletterFailed }, { status: 502 });
  }

  return Response.json({ ok: true, message: m.newsletterThanks });
}

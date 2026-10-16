import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { db } from "@/db";
import { altchaKey, decodePayload, verifySolution, ALTCHA_TTL_MS } from "@/lib/altcha";
import { listUuids, newsletterList } from "@/lib/newsletter-lists";
import { signupForm, signupRef } from "@/lib/newsletter-origin";
import { recordSignup } from "@/lib/newsletter-signups";
import { consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { siteDay } from "@/lib/views";
import { getClientIpHash } from "@/lib/utils";

const m = messages.api;

/** Intentos de suscripción por IP */
const RULE = { limit: 5, windowMs: 60 * 60 * 1000 } satisfies RateLimitRule;

/** Una solución ALTCHA sirve una sola vez mientras su challenge siga vigente */
const ALTCHA_ONCE = { limit: 1, windowMs: ALTCHA_TTL_MS } satisfies RateLimitRule;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/newsletter - reenvía la suscripción al servicio de newsletter
 * (feature `newsletter`).
 *
 * El formulario postea acá (mismo origen: la CSP no permite form-action ni
 * connect-src externos) y el servidor llama a NEWSLETTER_SUBSCRIBE_URL
 * (endpoint público de listmonk: POST /api/public/subscription con
 * { email, list_uuids }). Sin la variable, responde 503 y el formulario se
 * muestra deshabilitado.
 *
 * `list` elige la lista (src/lib/newsletter-lists.ts): sin campo o "apuntes" es
 * Apuntes (NEWSLETTER_LIST_UUIDS); "libro" es la lista de espera del libro
 * (NEWSLETTER_BOOK_LIST_UUIDS, 503 si está vacía); otro valor, 400. Las dos
 * pasan por la misma prueba de trabajo y el mismo rate limit por IP.
 *
 * Si listmonk la acepta, suma 1 al contador del día para el `ref` del link y el
 * formulario (`newsletter_signups`, sin mail ni IP): así se sabe qué trae altas.
 */
export async function POST(request: NextRequest) {
  if (!config.features.newsletter) notFound();

  const endpoint = process.env.NEWSLETTER_SUBSCRIBE_URL;
  if (!endpoint) {
    return Response.json({ ok: false, message: m.newsletterUnavailable }, { status: 503 });
  }

  let body: { email?: unknown; altcha?: unknown; ref?: unknown; form?: unknown; list?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: m.invalidRequest }, { status: 400 });
  }

  const list = newsletterList(body.list);
  if (!list) {
    return Response.json({ ok: false, message: m.invalidRequest }, { status: 400 });
  }
  // Apuntes conserva su comportamiento (sin UUIDs manda la lista vacía); el
  // libro sin su lista configurada no tiene adónde ir.
  const uuids = listUuids(list);
  if (list === "libro" && uuids.length === 0) {
    return Response.json({ ok: false, message: m.newsletterUnavailable }, { status: 503 });
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

  // Prueba de trabajo ALTCHA (src/lib/altcha.ts): sin ella, con opt-in simple,
  // un bot podría anotar direcciones ajenas y Apuntes les llegaría sin pedirlo.
  const key = altchaKey();
  const payload = decodePayload(body.altcha);
  if (!key || !payload || !verifySolution(payload, key)) {
    return Response.json({ ok: false, message: m.newsletterFailed }, { status: 400 });
  }
  const { allowed: fresh } = await consumeRateLimit(db, `altcha:${payload.signature}`, ALTCHA_ONCE);
  if (!fresh) {
    return Response.json({ ok: false, message: m.newsletterFailed }, { status: 400 });
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, list_uuids: uuids }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error("[pluma] newsletter: no se pudo suscribir", err);
    return Response.json({ ok: false, message: m.newsletterFailed }, { status: 502 });
  }

  await recordSignup(siteDay(config.timeZone), signupRef(body.ref), signupForm(body.form, list));
  return Response.json({
    ok: true,
    message: list === "libro" ? m.newsletterBookThanks : m.newsletterThanks,
  });
}

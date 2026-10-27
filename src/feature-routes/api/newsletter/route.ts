import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { db } from "@/db";
import { altchaKey, decodePayload, verifySolution, ALTCHA_TTL_MS } from "@/lib/altcha";
import { isAuthenticated } from "@/lib/auth";
import { listUuids, newsletterList } from "@/lib/newsletter-lists";
import { signupForm, signupRef, type SignupForm } from "@/lib/newsletter-origin";
import { NO_FORM, recordRejection, type Rejection } from "@/lib/newsletter-rejections";
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
 * Responde el error, deja una línea por rechazo con el motivo y lo suma al
 * contador del día (`newsletter_rejections`, sin mail ni IP):
 *
 *   [pluma] newsletter: rechazo {"reason":"captcha-invalido","status":400,"form":"articulo"}
 *
 * Los rechazos del admin logueado (probando el formulario) quedan en el log
 * pero no se cuentan, como sus altas. Sin la tabla (deploy antes que la
 * migración 0009) el rechazo responde igual. Lo que falla del lado de listmonk
 * sale como error.
 */
async function reject(
  reason: Rejection,
  status: number,
  message: string,
  form?: SignupForm,
  detail: Record<string, string | number> = {},
) {
  const log = reason.startsWith("listmonk-") ? console.error : console.warn;
  log(`[pluma] newsletter: rechazo ${JSON.stringify({ reason, status, form, ...detail })}`);
  if (!(await isAuthenticated())) {
    await recordRejection(siteDay(config.timeZone), reason, form ?? NO_FORM);
  }
  return Response.json({ ok: false, message }, { status });
}

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
 * Un alta del admin logueado (probando el formulario) va igual a listmonk pero
 * no se cuenta, como sus visitas en /api/view. Cada rechazo deja su motivo en
 * el log y en `newsletter_rejections` (ver `reject`).
 */
export async function POST(request: NextRequest) {
  if (!config.features.newsletter) notFound();

  const endpoint = process.env.NEWSLETTER_SUBSCRIBE_URL;
  if (!endpoint) return reject("sin-endpoint", 503, m.newsletterUnavailable);

  let body: { email?: unknown; altcha?: unknown; ref?: unknown; form?: unknown; list?: unknown };
  try {
    body = await request.json();
  } catch {
    return reject("body-invalido", 400, m.invalidRequest);
  }
  // JSON válido que no es un objeto (`null`, un número): antes era un 500
  if (!body || typeof body !== "object") return reject("body-invalido", 400, m.invalidRequest);

  const list = newsletterList(body.list);
  if (!list) return reject("lista-invalida", 400, m.invalidRequest);
  // En qué formulario fue, para los dos contadores y para el log de rechazos
  const form = signupForm(body.form, list);
  // Apuntes conserva su comportamiento (sin UUIDs manda la lista vacía); el
  // libro sin su lista configurada no tiene adónde ir.
  const uuids = listUuids(list);
  if (list === "libro" && uuids.length === 0) {
    return reject("lista-sin-configurar", 503, m.newsletterUnavailable, form);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    return reject("mail-invalido", 400, m.newsletterInvalid, form);
  }

  const ipHash = await getClientIpHash();
  if (!ipHash) return reject("sin-ip", 503, m.newsletterUnavailable, form);
  const { allowed } = await consumeRateLimit(db, `newsletter:${ipHash}`, RULE);
  if (!allowed) return reject("rate-limit", 429, m.newsletterTooMany, form);

  // Prueba de trabajo ALTCHA (src/lib/altcha.ts): sin ella, con opt-in simple,
  // un bot podría anotar direcciones ajenas y Apuntes les llegaría sin pedirlo.
  const key = altchaKey();
  const payload = decodePayload(body.altcha);
  if (!key || !payload || !verifySolution(payload, key)) {
    return reject("captcha-invalido", 400, m.newsletterFailed, form);
  }
  const { allowed: fresh } = await consumeRateLimit(db, `altcha:${payload.signature}`, ALTCHA_ONCE);
  if (!fresh) return reject("captcha-repetido", 400, m.newsletterFailed, form);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, list_uuids: uuids }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    // Red caída o timeout (TypeError o TimeoutError); el detalle, con su causa, aparte
    console.error("[pluma] newsletter: no se pudo suscribir", err);
    const error = err instanceof Error ? err.name : "desconocido";
    return reject("listmonk-sin-respuesta", 502, m.newsletterFailed, form, { error });
  }
  if (!res.ok) {
    const reason = res.status >= 500 ? "listmonk-5xx" : "listmonk-4xx";
    return reject(reason, 502, m.newsletterFailed, form, { upstream: res.status });
  }

  // El admin probando el formulario no es un alta que vino de un link
  if (!(await isAuthenticated())) {
    await recordSignup(siteDay(config.timeZone), signupRef(body.ref), form);
  }
  return Response.json({
    ok: true,
    message: list === "libro" ? m.newsletterBookThanks : m.newsletterThanks,
  });
}

import "server-only";
import { db } from "@/db";
import {
  authenticateToken,
  bearerToken,
  hasScope,
  type ApiPrincipal,
  type ApiScope,
} from "@/lib/api-tokens";
import type { FieldError } from "@/lib/post-input";
import { RULES, consumeRateLimit, isRateLimited } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/utils";
import type { PublishingMessages } from "@/tenants/types";

/**
 * Piezas comunes de /api/v1 (feature `publicApi`): autenticación con token,
 * rate limit, lectura del body y errores.
 *
 * Toda respuesta de error tiene la forma `{ ok: false, error, message, errors? }`:
 * `error` es un código estable para agentes, `message` el texto del tenant y
 * `errors` la lista `{ field, code }` de validación (src/lib/post-input.ts).
 */

export type ApiMessages = PublishingMessages["api"];

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "invalid_json"
  | "payload_too_large"
  | "invalid_payload"
  | "not_found"
  | "conflict"
  | "unavailable";

/** Un artículo largo con figuras ronda los 30 KB; esto deja margen de sobra */
const MAX_BODY_BYTES = 512 * 1024;

export function apiError(
  status: number,
  error: ApiErrorCode,
  message: string,
  errors?: FieldError[],
  headers?: HeadersInit,
): Response {
  return Response.json({ ok: false, error, message, ...(errors ? { errors } : {}) }, { status, headers });
}

export async function readJson(
  request: Request,
  m: ApiMessages,
): Promise<{ body: unknown } | { response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { response: apiError(413, "payload_too_large", m.tooLarge) };
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    return { response: apiError(413, "payload_too_large", m.tooLarge) };
  }
  try {
    return { body: JSON.parse(raw) as unknown };
  } catch {
    return { response: apiError(400, "invalid_json", m.invalidJson) };
  }
}

/**
 * Verifica `Authorization: Bearer <token>` y el scope, y recién ahí corre el
 * handler. Los intentos sin token válido cuentan por IP (como el login); las
 * llamadas autenticadas, por token.
 */
export async function withApiToken(
  request: Request,
  scope: ApiScope,
  m: ApiMessages,
  handler: (principal: ApiPrincipal) => Promise<Response>,
): Promise<Response> {
  const ipHash = await getClientIpHash();
  const failKey = ipHash ? `api-auth:${ipHash}` : null;
  if (failKey && (await isRateLimited(db, failKey, RULES.apiAuth))) {
    return apiError(429, "rate_limited", m.rateLimited);
  }

  const token = bearerToken(request.headers.get("authorization"));
  let principal: ApiPrincipal | null = null;
  if (token) {
    try {
      principal = await authenticateToken(db, token);
    } catch (err) {
      console.error("[pluma] api: no se pudo verificar el token (¿falta aplicar drizzle/0003?)", err);
      return apiError(503, "unavailable", m.unavailable);
    }
  }
  if (!principal) {
    if (failKey) await consumeRateLimit(db, failKey, RULES.apiAuth);
    return apiError(401, "unauthorized", m.unauthorized, undefined, {
      "WWW-Authenticate": 'Bearer realm="api"',
    });
  }

  const { allowed } = await consumeRateLimit(db, `api:${principal.id}`, RULES.api);
  if (!allowed) return apiError(429, "rate_limited", m.rateLimited);
  if (!hasScope(principal.scopes, scope)) return apiError(403, "forbidden", m.forbidden);

  return handler(principal);
}

/** Columna de una violación de UNIQUE de SQLite (p. ej. "articles.slug"), buscando también en `cause` */
export function uniqueViolation(err: unknown): string | null {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const text = e instanceof Error ? e.message : String(e);
    const match = /UNIQUE constraint failed: ([\w.]+)/.exec(text);
    if (match) return match[1];
  }
  return null;
}

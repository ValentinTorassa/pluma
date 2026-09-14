/**
 * Tokens de la API de publicación (/api/v1, feature `publicApi`).
 *
 * Formato: `pluma_` + 32 bytes aleatorios en base64url (43 caracteres). En la
 * base solo queda el SHA-256 (hex), así que una copia de la tabla no sirve
 * para llamar a la API. El valor se imprime una sola vez al crearlo
 * (scripts/create-api-token.mjs repite estas reglas: si cambian acá, allá también).
 *
 * Sin `server-only` a propósito: recibe la db por parámetro para poder
 * testearlo con una SQLite en memoria (igual que rate-limit.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { apiTokens } from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = LibSQLDatabase<any>;

/**
 * - `posts:read`    leer artículos (incluidos borradores) y series
 * - `posts:write`   crear y editar borradores
 * - `posts:publish` publicar, despublicar o editar un artículo ya publicado
 * - `series:write`  crear series
 */
export const API_SCOPES = ["posts:read", "posts:write", "posts:publish", "series:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Scopes que incluyen a otros: quien escribe o publica también puede leer */
const IMPLIES: Partial<Record<ApiScope, readonly ApiScope[]>> = {
  "posts:write": ["posts:read"],
  "posts:publish": ["posts:read"],
};

export const TOKEN_PREFIX = "pluma_";
const TOKEN_PATTERN = /^pluma_[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Token de un header `Authorization: Bearer …`; null si falta o no tiene el formato */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header ?? "");
  return match && isWellFormedToken(match[1]) ? match[1] : null;
}

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === "string" && (API_SCOPES as readonly string[]).includes(value);
}

/** Columna `scopes` (JSON) → scopes conocidos, sin repetidos. Lo que no se entiende se ignora. */
export function parseScopes(raw: string): ApiScope[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter(isApiScope))] : [];
  } catch {
    return [];
  }
}

export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  return granted.some(
    (scope) => scope === required || (isApiScope(scope) && (IMPLIES[scope]?.includes(required) ?? false)),
  );
}

export type ApiPrincipal = { id: string; name: string; scopes: ApiScope[] };

/**
 * Busca un token vigente (no revocado) por su hash y anota `last_used_at`.
 * Devuelve null si no existe, está revocado o no tiene el formato.
 */
export async function authenticateToken(
  db: Db,
  token: string,
  now = new Date(),
): Promise<ApiPrincipal | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db
    .select({ id: apiTokens.id, name: apiTokens.name, scopes: apiTokens.scopes })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)));
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  return { id: row.id, name: row.name, scopes: parseScopes(row.scopes) };
}

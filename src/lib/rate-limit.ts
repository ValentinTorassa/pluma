/**
 * Rate limiting persistido en la tabla `rate_limits` (ventana fija).
 * Vercel no comparte memoria entre instancias, por eso vive en la base.
 *
 * Fail-open: si la base falla (p. ej. la migración todavía no se aplicó)
 * se loguea y se permite la acción. Un limitador roto nunca debe dejar a la
 * autora sin poder ingresar ni romper los votos.
 *
 * Sin `server-only` a propósito: recibe la db por parámetro para poder
 * testearlo con una SQLite en memoria.
 */
import { eq, lt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { rateLimits } from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = LibSQLDatabase<any>;

export type RateLimitRule = { limit: number; windowMs: number };

export const RULES = {
  /** Intentos de login fallidos por IP */
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Toggles de voto por IP */
  upvote: { limit: 30, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;

function logFailure(action: string, err: unknown) {
  console.error(`[pluma] rate limit (${action}) no disponible, se permite la acción:`, err);
}

/** Registra un intento. `allowed` es false si con este intento se superó el límite. */
export async function consumeRateLimit(
  db: Db,
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<{ allowed: boolean; count: number }> {
  const expired = sql`${rateLimits.windowStart} <= ${now - rule.windowMs}`;
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${expired} then ${now} else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count });

    // Limpieza oportunista de contadores viejos (~1% de las veces)
    if (Math.random() < 0.01) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, now - CLEANUP_AFTER_MS));
    }

    return { allowed: row.count <= rule.limit, count: row.count };
  } catch (err) {
    logFailure("consume", err);
    return { allowed: true, count: 0 };
  }
}

/** true si la clave ya agotó su cupo en la ventana actual (no suma un intento). */
export async function isRateLimited(
  db: Db,
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<boolean> {
  try {
    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    return !!row && row.windowStart > now - rule.windowMs && row.count >= rule.limit;
  } catch (err) {
    logFailure("check", err);
    return false;
  }
}

export async function resetRateLimit(db: Db, key: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(eq(rateLimits.key, key));
  } catch (err) {
    logFailure("reset", err);
  }
}

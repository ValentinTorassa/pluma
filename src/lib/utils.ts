import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { headers } from "next/headers";

/** Obtiene la IP del visitante desde los headers (Vercel setea x-forwarded-for) */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Hash irreversible de la IP: permite deduplicar sin guardar datos personales.
 * IP_SALT es obligatoria: sin ella el hash sería predecible. Si falta,
 * devuelve null (y lo loguea) para que solo se rechacen las acciones que
 * necesitan el hash (votos, comentarios) sin romper el sitio público.
 */
export async function getClientIpHash(): Promise<string | null> {
  const salt = process.env.IP_SALT;
  if (!salt) {
    console.error("[pluma] Falta IP_SALT: votos, comentarios y rate limiting deshabilitados");
    return null;
  }
  const ip = await getClientIp();
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

/** Comparación en tiempo constante para credenciales */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Genera un slug URL-safe a partir de un título (quita acentos). Vive en slug.ts para usarlo sin server-only. */
export { slugify } from "./slug";

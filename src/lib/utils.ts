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

/** Hash irreversible de la IP: permite deduplicar sin guardar datos personales */
export async function getClientIpHash(): Promise<string> {
  const ip = await getClientIp();
  const salt = process.env.IP_SALT ?? "pluma-default-salt";
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

/** Genera un slug URL-safe a partir de un título (quita acentos) */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

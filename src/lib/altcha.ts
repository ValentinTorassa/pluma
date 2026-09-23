/**
 * Prueba de trabajo ALTCHA (SHA-256) para el formulario del newsletter, sin
 * dependencias ni scripts de terceros. Mismo formato que el widget de ALTCHA:
 *
 * - El servidor elige `salt` (con `?expires=` adentro) y un número secreto,
 *   publica `challenge = sha256(salt + número)` y lo firma con HMAC.
 * - El navegador prueba números hasta dar con el challenge (`altcha-solve.ts`)
 *   y devuelve el payload en base64.
 * - `verifySolution` rehace el hash, controla firma y vencimiento. Lo que no
 *   hace es impedir que se reuse una solución: eso lo hace la ruta, que gasta
 *   la firma en `rate_limits` con cupo 1.
 *
 * La clave HMAC es ALTCHA_HMAC_KEY o, si no está, una derivada de IP_SALT
 * (con separación de dominio), para no sumar un secreto más al deploy.
 *
 * Sin `server-only` a propósito, como rate-limit.ts: así se testea directo.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const ALTCHA_ALGORITHM = "SHA-256";
/** ~25k hashes en promedio: medio segundo en un teléfono, caro en volumen para un bot */
export const ALTCHA_MAX_NUMBER = 50_000;
export const ALTCHA_TTL_MS = 10 * 60 * 1000;

export type AltchaChallenge = {
  algorithm: typeof ALTCHA_ALGORITHM;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
};

export type AltchaPayload = {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: string, s: string) => createHmac("sha256", key).update(s).digest("hex");

/** null si no hay ni ALTCHA_HMAC_KEY ni IP_SALT: la ruta responde 503 */
export function altchaKey(env: Record<string, string | undefined> = process.env): string | null {
  if (env.ALTCHA_HMAC_KEY) return env.ALTCHA_HMAC_KEY;
  if (env.IP_SALT) return hmac(env.IP_SALT, "pluma:altcha:v1");
  return null;
}

export function createChallenge(
  key: string,
  now = Date.now(),
  maxnumber = ALTCHA_MAX_NUMBER,
): AltchaChallenge {
  const expires = Math.floor((now + ALTCHA_TTL_MS) / 1000);
  const salt = `${randomBytes(12).toString("hex")}?expires=${expires}`;
  const challenge = sha256(salt + randomInt(0, maxnumber + 1));
  return { algorithm: ALTCHA_ALGORITHM, challenge, maxnumber, salt, signature: hmac(key, challenge) };
}

function safeHexEqual(a: string, b: string): boolean {
  // Sin el chequeo de hex, Buffer.from descarta lo inválido y timingSafeEqual
  // tira por largos distintos: un payload basura terminaría en un 500.
  const hex = /^(?:[0-9a-f]{2})+$/;
  if (a.length !== b.length || !hex.test(a) || !hex.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Decodifica el campo `altcha` (base64 de JSON). null si no tiene la forma esperada. */
export function decodePayload(raw: unknown): AltchaPayload | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Partial<AltchaPayload>;
    if (
      typeof p.algorithm !== "string" ||
      typeof p.challenge !== "string" ||
      typeof p.salt !== "string" ||
      typeof p.signature !== "string" ||
      !Number.isSafeInteger(p.number)
    ) {
      return null;
    }
    return p as AltchaPayload;
  } catch {
    return null;
  }
}

/** true si el payload resuelve un challenge firmado por esta clave y todavía vigente */
export function verifySolution(payload: AltchaPayload, key: string, now = Date.now()): boolean {
  if (payload.algorithm !== ALTCHA_ALGORITHM) return false;
  if (payload.number < 0 || payload.number > ALTCHA_MAX_NUMBER) return false;
  const expires = Number(new URLSearchParams(payload.salt.split("?")[1] ?? "").get("expires"));
  if (!Number.isFinite(expires) || expires * 1000 <= now) return false;
  if (!safeHexEqual(sha256(payload.salt + payload.number), payload.challenge)) return false;
  return safeHexEqual(hmac(key, payload.challenge), payload.signature);
}

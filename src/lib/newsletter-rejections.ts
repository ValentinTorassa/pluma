import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterRejections } from "@/db/schema";
import type { SignupForm } from "./newsletter-origin";

/**
 * Por qué no se anotó un alta (`POST /api/newsletter`): un conjunto cerrado,
 * para que el contador tenga pocas filas por día y el log se pueda agrupar.
 */
export const REJECTIONS = [
  "sin-endpoint",
  "body-invalido",
  "lista-invalida",
  "lista-sin-configurar",
  "mail-invalido",
  "sin-ip",
  "rate-limit",
  "captcha-invalido",
  "captcha-repetido",
  "listmonk-4xx",
  "listmonk-5xx",
  "listmonk-sin-respuesta",
] as const;

export type Rejection = (typeof REJECTIONS)[number];

/** Formulario de un rechazo previo a saber la lista (sin endpoint, body roto, lista desconocida) */
export const NO_FORM = "ninguno";

/**
 * Suma un rechazo al contador del día para ese motivo y formulario. Devuelve
 * si quedó registrado y no propaga el error, como `recordSignup`: el deploy
 * puede llegar antes que la migración 0009, y un rechazo tiene que responder
 * su propio error, no un 500 por una métrica.
 */
export async function recordRejection(
  day: string,
  reason: Rejection,
  form: SignupForm | typeof NO_FORM,
): Promise<boolean> {
  try {
    await db
      .insert(newsletterRejections)
      .values({ day, reason, form, count: 1 })
      .onConflictDoUpdate({
        target: [newsletterRejections.day, newsletterRejections.reason, newsletterRejections.form],
        set: { count: sql`${newsletterRejections.count} + 1` },
      });
    return true;
  } catch (err) {
    console.error("[pluma] no se pudo contar el rechazo del alta, sigue de largo:", err);
    return false;
  }
}

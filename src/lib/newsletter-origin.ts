/**
 * De dónde vino un alta a la newsletter (feature `newsletter`).
 *
 * Dos datos, los dos elegidos de un conjunto chico y sin nada de la persona:
 * - `ref`: el `?ref=` del link que la trajo (uno por red y uno por charla, por
 *   ejemplo `/apuntes?ref=charla-owasp`). Sin ref es `directo`; algo que no
 *   parece un ref es `otro`, para que un link roto no invente filas.
 * - `form`: en qué formulario se anotó (la página de Apuntes, el pie de una
 *   nota o la home), a partir del `id` del formulario.
 *
 * Pura: la usa el route handler y se prueba sin base.
 */

export const SIGNUP_FORMS = {
  "nl-q": "apuntes",
  "nl-art": "articulo",
  "nl-home": "home",
} as const;

export type SignupForm = (typeof SIGNUP_FORMS)[keyof typeof SIGNUP_FORMS] | "otro";

const REF = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function signupRef(raw: unknown): string {
  const ref = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!ref) return "directo";
  return REF.test(ref) ? ref : "otro";
}

export function signupForm(raw: unknown): SignupForm {
  const forms: Record<string, SignupForm> = SIGNUP_FORMS;
  return typeof raw === "string" && Object.hasOwn(forms, raw) ? forms[raw] : "otro";
}

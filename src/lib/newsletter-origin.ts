/**
 * De dónde vino un alta a la newsletter (feature `newsletter`).
 *
 * Dos datos, los dos elegidos de un conjunto chico y sin nada de la persona:
 * - `ref`: el `?ref=` del link que la trajo (uno por red y uno por charla, por
 *   ejemplo `/apuntes?ref=charla-owasp`). Sin ref es `directo`; algo que no
 *   parece un ref es `otro`, para que un link roto no invente filas.
 * - `form`: en qué formulario se anotó (la página de Apuntes, el pie de una
 *   nota o la home), a partir del `id` del formulario. Las altas a la lista de
 *   espera del libro cuentan siempre como `libro`: la tabla no guarda la lista,
 *   así que el formulario es lo que separa una lista de la otra.
 *
 * Pura: la usa el route handler y se prueba sin base.
 */
import type { NewsletterList } from "./newsletter-lists";

export const SIGNUP_FORMS = {
  "nl-q": "apuntes",
  "nl-art": "articulo",
  "nl-home": "home",
} as const;

/** Formulario con el que se cuenta toda alta a la lista del libro (/libro) */
export const BOOK_SIGNUP_FORM = "libro";

export type SignupForm =
  | (typeof SIGNUP_FORMS)[keyof typeof SIGNUP_FORMS]
  | typeof BOOK_SIGNUP_FORM
  | "otro";

const REF = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function signupRef(raw: unknown): string {
  const ref = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!ref) return "directo";
  return REF.test(ref) ? ref : "otro";
}

/**
 * El formulario de un alta. En Apuntes sale del id (uno desconocido es `otro`);
 * en el libro es siempre `libro`, sin importar el id que mande el body, para
 * que un alta al libro nunca sume en una fila de Apuntes ni al revés.
 */
export function signupForm(raw: unknown, list: NewsletterList = "apuntes"): SignupForm {
  if (list === "libro") return BOOK_SIGNUP_FORM;
  const forms: Record<string, SignupForm> = SIGNUP_FORMS;
  return typeof raw === "string" && Object.hasOwn(forms, raw) ? forms[raw] : "otro";
}

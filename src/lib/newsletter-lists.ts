/**
 * A qué lista de listmonk va un alta (feature `newsletter`).
 *
 * POST /api/newsletter atiende las dos listas con la misma protección (ALTCHA,
 * rate limit, conteo de origen); el campo `list` del body elige cuál:
 * - sin `list` o `"apuntes"`: Apuntes, con NEWSLETTER_LIST_UUIDS.
 * - `"libro"`: la lista de espera del libro, con NEWSLETTER_BOOK_LIST_UUIDS.
 *
 * Cualquier otro valor no es una lista: la ruta responde 400, así un body
 * armado a mano no cae en Apuntes por descarte.
 *
 * Pura: la usan el route handler y el formulario (para mostrarse deshabilitado
 * si la lista no está configurada) y se prueba sin base.
 */

export const NEWSLETTER_LISTS = {
  apuntes: "NEWSLETTER_LIST_UUIDS",
  libro: "NEWSLETTER_BOOK_LIST_UUIDS",
} as const;

export type NewsletterList = keyof typeof NEWSLETTER_LISTS;

type Env = Record<string, string | undefined>;

/** La lista pedida, o null si `raw` no es una lista conocida */
export function newsletterList(raw: unknown): NewsletterList | null {
  if (raw === undefined || raw === null || raw === "") return "apuntes";
  return typeof raw === "string" && Object.hasOwn(NEWSLETTER_LISTS, raw) ? (raw as NewsletterList) : null;
}

/** UUIDs de listmonk de esa lista (variable separada por comas; vacía = ninguno) */
export function listUuids(list: NewsletterList, env: Env = process.env): string[] {
  return (env[NEWSLETTER_LISTS[list]] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Si el formulario de esa lista puede andar. Apuntes solo necesita el endpoint
 * (como siempre); el libro además su UUID, porque mandar el alta sin lista la
 * dejaría en listmonk sin destino.
 */
export function listEnabled(list: NewsletterList, env: Env = process.env): boolean {
  if (!env.NEWSLETTER_SUBSCRIBE_URL) return false;
  return list === "apuntes" || listUuids(list, env).length > 0;
}

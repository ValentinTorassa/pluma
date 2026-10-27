import { config } from "../config";

/**
 * El primer `?ref=` de la sesión (feature `newsletter`), para que un alta no lo
 * pierda cuando la persona entró por un link con ref (a un artículo, a un
 * número de Apuntes) y se anotó en otra página, por ejemplo en /apuntes.
 *
 * Va en sessionStorage: dura lo que la pestaña, no sigue a nadie entre visitas
 * y no sale del navegador más que como el `ref` del alta, que ya se mandaba. Se
 * guarda tal cual: el servidor lo normaliza con `signupRef`, así que un ref
 * roto cuenta como `otro`, igual que si se anotara en la página del link. Gana
 * el primero: otro link en la misma sesión no lo pisa. El ref de la URL actual,
 * si hay, manda sobre el guardado.
 */
export const REF_KEY = `${config.storagePrefix}:ref`;

/** Un ref más largo ya es `otro` para `signupRef` (48): no hace falta guardar más */
const MAX_LENGTH = 64;

type RefStorage = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage, o null si no está (bloqueado, modo privado, fuera del navegador) */
export function sessionStore(): RefStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function refIn(search: string): string | null {
  const ref = new URLSearchParams(search).get("ref")?.trim();
  return ref ? ref.slice(0, MAX_LENGTH) : null;
}

/** Guarda el ref de la URL si es el primero de la sesión */
export function rememberRef(search: string, storage: RefStorage | null = sessionStore()): void {
  const ref = refIn(search);
  if (!ref || !storage) return;
  try {
    if (!storage.getItem(REF_KEY)) storage.setItem(REF_KEY, ref);
  } catch {
    /* sin sessionStorage: el ref vale solo en la página del link */
  }
}

/** El ref que va con el alta: el de la URL actual o, si no tiene, el primero de la sesión */
export function signupRefFor(search: string, storage: RefStorage | null = sessionStore()): string | null {
  const ref = refIn(search);
  if (ref) return ref;
  try {
    return storage?.getItem(REF_KEY) || null;
  } catch {
    return null;
  }
}

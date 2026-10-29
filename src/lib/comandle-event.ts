/**
 * Eventos del juego comandle (feature `comandleStats`).
 *
 * comandle.valentorassa.com es un sitio estático en otro origen que le avisa a
 * POST /api/comandle unas pocas cosas para saber cómo se juega, sin saber quién
 * juega: cada pedido es un `{ event, key }` y suma 1 al contador del día de ese
 * par (`comandle_daily`). Los eventos son un conjunto cerrado; las claves
 * también, salvo `ref` y `from`, que tienen que tener forma de ref o de host
 * (si no, cuentan como `otro`).
 *
 *   ref     el `?ref=` del link que trajo al jugador, con las reglas de las
 *           altas a la newsletter (`directo` sin ref, `otro` si no parece uno)
 *   from    host del referrer en minúsculas (`ninguno` sin referrer, `otro`
 *           si no parece un host)
 *   start   `-`: primer intento de la ronda del día
 *   finish  `1`..`6` (ganó en N intentos) o `x` (perdió)
 *   streak  tramo de la racha al terminar una ronda: 1, 2-3, 4-7, 8-14, 15+
 *   share   `-`: copió su resultado
 *
 * Cualquier otro evento, o una clave fuera del conjunto en los de clave fija,
 * no se cuenta (400). Pura: la usa el route handler y se prueba sin base.
 *
 * Cada evento suma también en `comandle_hourly`, en la hora (`00`..`23`, zona
 * del sitio) en que llega al servidor. La hora no la manda el juego: el juego
 * avisa en el momento (`keepalive`, sin cola) y no hay nada nuevo que lo
 * identifique.
 */
import { signupRef } from "./newsletter-origin";

/** El único origen que puede sumar */
export const COMANDLE_ORIGIN = "https://comandle.valentorassa.com";

/** Un `{ event, key }` válido ocupa menos de 100 bytes: más que esto no es del juego */
export const MAX_BODY_BYTES = 512;

export type ComandleEvent = "ref" | "from" | "start" | "finish" | "streak" | "share";

/** Claves de los eventos que no traen un valor libre */
const FIXED_KEYS = {
  start: ["-"],
  finish: ["1", "2", "3", "4", "5", "6", "x"],
  streak: ["1", "2-3", "4-7", "8-14", "15+"],
  share: ["-"],
} as const satisfies Record<string, readonly string[]>;

const HOST = /^[a-z0-9.-]{1,64}$/;

/**
 * La hora `00`..`23` de `now` en `timeZone`, la del mismo reloj que `siteDay`:
 * la medianoche es `00` del día nuevo, nunca `24` del anterior.
 */
export function siteHour(timeZone: string, now = new Date()): string {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return (hour ?? "00").padStart(2, "0");
}

/** Host del referrer: `ninguno` si no hubo, `otro` si no parece un host */
export function referrerHost(raw: string): string {
  const host = raw.trim().toLowerCase();
  if (!host) return "ninguno";
  return HOST.test(host) ? host : "otro";
}

/**
 * El evento y la clave que se cuentan, o `null` si el body no es un evento del
 * juego. Los campos que sobren se ignoran: no se guarda nada más que el par.
 */
export function comandleEvent(body: unknown): { event: ComandleEvent; key: string } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { event, key } = body as { event?: unknown; key?: unknown };
  if (typeof key !== "string") return null;
  switch (event) {
    case "ref":
      return { event, key: signupRef(key) };
    case "from":
      return { event, key: referrerHost(key) };
    case "start":
    case "finish":
    case "streak":
    case "share":
      return (FIXED_KEYS[event] as readonly string[]).includes(key) ? { event, key } : null;
    default:
      return null;
  }
}

/**
 * El body como texto, o `null` si pasa de `max` bytes. Corta apenas se pasa
 * (declarado o leyendo) en vez de cargar entero lo que manden.
 */
export async function readCappedText(request: Request, max = MAX_BODY_BYTES): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

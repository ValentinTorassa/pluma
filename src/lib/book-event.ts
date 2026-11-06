/** Aggregate book clicks. No free-form dimension or visitor identifier is stored. */
export const BOOK_ORIGINS = [
  "https://valentorassa.com",
  "https://vtsecurity.com.ar",
  "https://blog.valentorassa.com",
] as const;

/** Same list as `refs` in ValenTorassa-Web's src/bookMetrics.ts: change both together. */
export const BOOK_REFS = [
  "directo", "otro", "web-libro", "jcc-qr", "labs-cap1", "apuntes-3",
  "muestra-linkedin", "muestra-instagram", "muestra-instagram-stories", "muestra-youtube", "muestra-x",
  "muestra-bluesky", "muestra-threads", "muestra-facebook", "muestra-discord",
  "muestra-mastodon", "muestra-whatsapp", "muestra-apuntes", "muestra-ejemplos",
  "muestra-pdf",
  // links.vtsecurity.com.ar forwards its own ?ref= as links-<ref> (ValenTorassa-Web, src/linksContent.ts bioRefs).
  "links", "links-ig", "links-tt", "links-x", "links-th", "links-yt", "links-li", "links-bs", "links-fb",
  "links-md", "links-dc", "links-gh", "links-wa", "links-tiktok", "links-threads", "links-bluesky",
  "links-mastodon", "links-linkedin", "links-yt-short", "links-yt-desc", "links-whatsapp", "links-discord",
  // comandle.valentorassa.com links the book from a command's card with ?ref=comandle.
  "comandle",
  // Press emails and WhatsApps for the 10/11/2026 launch: prensa-<outlet>, -wa when sent by WhatsApp.
  "prensa-elciudadano", "prensa-eltres-wa", "prensa-lacapital", "prensa-lacapital-pardo", "prensa-lra5",
  "prensa-lt8-ameriso", "prensa-lt8-wa", "prensa-r3-de12a14", "prensa-r3-editor", "prensa-r3-redaccion",
  "prensa-radio2-wa", "prensa-radiounr", "prensa-rosario12", "prensa-uai", "prensa-unr",
] as const;

export type BookRef = (typeof BOOK_REFS)[number];
export type BookEvent = "pdf" | "lista";

export function bookOrigin(raw: string | null): string | null {
  return raw && (BOOK_ORIGINS as readonly string[]).includes(raw) ? raw : null;
}

/** Unknown tags collapse to one bucket, even when they look like valid campaign names. */
export function bookRef(raw: unknown): BookRef {
  if (raw === undefined || raw === null || raw === "") return "directo";
  if (typeof raw !== "string") return "otro";
  const ref = raw.trim().toLowerCase();
  if (!ref) return "directo";
  return (BOOK_REFS as readonly string[]).includes(ref) ? ref as BookRef : "otro";
}

export function bookEvent(body: unknown): { event: BookEvent; ref: BookRef } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { event, ref } = body as { event?: unknown; ref?: unknown };
  return event === "pdf" || event === "lista" ? { event, ref: bookRef(ref) } : null;
}

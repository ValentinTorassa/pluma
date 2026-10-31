/** Aggregate book clicks. No free-form dimension or visitor identifier is stored. */
export const BOOK_ORIGINS = [
  "https://valentorassa.com",
  "https://vtsecurity.com.ar",
  "https://blog.valentorassa.com",
] as const;

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

/**
 * Validación de artículos y series que llegan de afuera: la API /api/v1 y los
 * campos de serie y número de Apuntes del admin.
 *
 * Mismo criterio que el resto del repo (sin librerías: cada campo se coerciona
 * y recorta a mano), con una diferencia: acá lo que no cumple se RECHAZA con
 * un código por campo en vez de truncarse, para que un agente se entere de que
 * mandó algo mal en lugar de guardar otra cosa.
 *
 * Puro (sin db ni server-only) para poder testearlo.
 */
import { slugify } from "./slug";

export type FieldErrorCode = "required" | "type" | "too_long" | "invalid" | "unknown_field" | "empty";
export type FieldError = { field: string; code: FieldErrorCode };
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export const LIMITS = {
  title: 200,
  excerpt: 500,
  content: 200_000,
  tag: 40,
  tags: 10,
  url: 500,
  seriesTitle: 120,
  summary: 300,
  description: 2_000,
  seriesOrder: 999,
  issueNumber: 9_999,
  plannedParts: 99,
} as const;

export type PostStatus = "draft" | "published";

/** Campos presentes = campos a guardar. `null` borra (serie, orden, número, portada). */
export type PostInput = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  coverImage?: string | null;
  status?: PostStatus;
  /** Slug de la serie */
  series?: string | null;
  seriesOrder?: number | null;
  issueNumber?: number | null;
};

export type SeriesInput = {
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
  plannedParts?: number | null;
};

export type PostInputOptions = {
  /** PATCH: todo es opcional, pero tiene que venir al menos un campo */
  partial: boolean;
  /** Acepta `series` y `seriesOrder` (feature `series`) */
  series: boolean;
  /** Acepta `issueNumber` (feature `apuntes`) */
  issues: boolean;
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Entero opcional entre `min` y `max`. Acepta número o texto ("3"); vacío o null = null. */
export function parseIntField(
  value: unknown,
  max: number,
  min = 1,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\s*\d+\s*$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}

/** Texto: recortado, con largo máximo. `required` = tiene que venir y no estar vacío. */
function readText(
  body: Record<string, unknown>,
  field: string,
  max: number,
  errors: FieldError[],
  required: boolean,
): string | undefined {
  const value = body[field];
  if (value === undefined) {
    if (required) errors.push({ field, code: "required" });
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push({ field, code: "type" });
    return undefined;
  }
  const text = value.trim();
  if (required && !text) {
    errors.push({ field, code: "required" });
    return undefined;
  }
  if (text.length > max) {
    errors.push({ field, code: "too_long" });
    return undefined;
  }
  return text;
}

function readSlug(body: Record<string, unknown>, field: string, errors: FieldError[]): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    errors.push({ field, code: "type" });
    return undefined;
  }
  const slug = slugify(value);
  if (!slug) errors.push({ field, code: "invalid" });
  return slug || undefined;
}

function readInt(
  body: Record<string, unknown>,
  field: string,
  max: number,
  errors: FieldError[],
): number | null | undefined {
  if (body[field] === undefined) return undefined;
  const parsed = parseIntField(body[field], max);
  if (!parsed.ok) {
    errors.push({ field, code: "invalid" });
    return undefined;
  }
  return parsed.value;
}

function unknownFields(body: Record<string, unknown>, allowed: readonly string[]): FieldError[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((field) => ({ field, code: "unknown_field" as const }));
}

/** Tags: array de textos o "a, b, c". Se normalizan igual que en el admin (minúsculas, sin repetidos). */
function readTags(body: Record<string, unknown>, errors: FieldError[]): string[] | undefined {
  const value = body.tags;
  if (value === undefined) return undefined;
  const list =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value) && value.every((t) => typeof t === "string")
        ? (value as string[])
        : null;
  if (!list) {
    errors.push({ field: "tags", code: "type" });
    return undefined;
  }
  const tags = [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > LIMITS.tags || tags.some((t) => t.length > LIMITS.tag)) {
    errors.push({ field: "tags", code: "too_long" });
    return undefined;
  }
  return tags;
}

/** Portada: URL https o ruta del sitio ("/images/x.png"); null o "" la quita */
function readCover(body: Record<string, unknown>, errors: FieldError[]): string | null | undefined {
  const value = body.coverImage;
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.push({ field: "coverImage", code: "type" });
    return undefined;
  }
  const url = value.trim();
  if (url.length > LIMITS.url) {
    errors.push({ field: "coverImage", code: "too_long" });
    return undefined;
  }
  if (!/^https:\/\/[^\s"'<>]+$/.test(url) && !/^\/(?!\/)[^\s"'<>]*$/.test(url)) {
    errors.push({ field: "coverImage", code: "invalid" });
    return undefined;
  }
  return url;
}

const POST_FIELDS = ["title", "slug", "excerpt", "content", "tags", "coverImage", "status"] as const;

export function parsePostInput(body: unknown, options: PostInputOptions): Parsed<PostInput> {
  if (!isPlainObject(body)) return { ok: false, errors: [{ field: "body", code: "type" }] };

  const allowed: string[] = [...POST_FIELDS];
  if (options.series) allowed.push("series", "seriesOrder");
  if (options.issues) allowed.push("issueNumber");
  const errors = unknownFields(body, allowed);
  if (options.partial && Object.keys(body).length === 0) {
    errors.push({ field: "body", code: "empty" });
  }

  const value: PostInput = {};
  value.title = readText(body, "title", LIMITS.title, errors, !options.partial || body.title !== undefined);
  value.slug = readSlug(body, "slug", errors);
  value.excerpt = readText(body, "excerpt", LIMITS.excerpt, errors, false);
  value.content = readText(body, "content", LIMITS.content, errors, false);
  value.tags = readTags(body, errors);
  value.coverImage = readCover(body, errors);

  if (body.status !== undefined) {
    if (body.status === "draft" || body.status === "published") value.status = body.status;
    else errors.push({ field: "status", code: "invalid" });
  }

  if (options.series) {
    if (body.series === null || body.series === "") value.series = null;
    else value.series = readSlug(body, "series", errors);
    value.seriesOrder = readInt(body, "seriesOrder", LIMITS.seriesOrder, errors);
  }
  if (options.issues) {
    value.issueNumber = readInt(body, "issueNumber", LIMITS.issueNumber, errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  // Sin claves `undefined`: lo que no vino no se toca
  const clean = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
  return { ok: true, value: clean as PostInput };
}

const SERIES_FIELDS = ["title", "slug", "summary", "description", "plannedParts"] as const;

export function parseSeriesInput(body: unknown): Parsed<SeriesInput> {
  if (!isPlainObject(body)) return { ok: false, errors: [{ field: "body", code: "type" }] };
  const errors = unknownFields(body, SERIES_FIELDS);

  const title = readText(body, "title", LIMITS.seriesTitle, errors, true);
  const value: SeriesInput = {
    title: title ?? "",
    slug: readSlug(body, "slug", errors),
    summary: readText(body, "summary", LIMITS.summary, errors, false),
    description: readText(body, "description", LIMITS.description, errors, false),
    plannedParts: readInt(body, "plannedParts", LIMITS.plannedParts, errors),
  };

  if (errors.length > 0) return { ok: false, errors };
  const clean = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
  return { ok: true, value: clean as SeriesInput };
}

/** Bajada automática al publicar sin excerpt: la primera oración o los primeros ~220 caracteres */
export function autoExcerpt(content: string): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`\[\]()#-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  const cut = plain.slice(0, 220);
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("¡"));
  return (last > 80 ? cut.slice(0, last + 1) : cut).trim();
}

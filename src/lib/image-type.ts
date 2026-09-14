/**
 * Detección del tipo real de una imagen por sus "magic bytes".
 * Nunca confiamos en el Content-Type ni en la extensión que manda el cliente:
 * un SVG o un HTML renombrado a .png no pasa.
 */

export const ALLOWED_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

/** Valor para el atributo `accept` de los <input type="file"> */
export const IMAGE_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Devuelve el tipo detectado si es uno de los permitidos, o null. */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

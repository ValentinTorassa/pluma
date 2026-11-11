/**
 * Respuesta liviana para el crawler de vistas previas de Meta en la home
 * (feature `previewBotHome`).
 *
 * `facebookexternalhit` pide `/` cada ~3 minutos, día y noche, desde varias
 * regiones: el 11/11/2026 eran ~300 pedidos por día y tres de cada cuatro
 * renders de la home de vtsecurity.com.ar. Las páginas se renderizan en cada
 * pedido (el nonce de la CSP lo exige), así que cada uno era un render completo
 * pagado en CPU de Vercel. El crawler solo lee las etiquetas del <head>: el
 * proxy le devuelve esas etiquetas, copiadas del HTML real de la home.
 *
 * Las etiquetas salen de la home misma, no de una copia de su metadata: lo que
 * cambie en la home (título, descripción, imagen) le llega al crawler igual.
 */

/** Solo el crawler de vistas previas, no `meta-externalagent` (que lee contenido). */
export const PREVIEW_BOT = /facebookexternalhit/i;

/** Cuánto se reusan las etiquetas antes de volver a pedir la home. */
export const PREVIEW_TTL_MS = 60 * 60 * 1000;

const HEAD_TAG =
  /<title>[^<]*<\/title>|<meta\s[^>]*(?:property|name)="(?:og:|twitter:|description")[^>]*>|<link\s[^>]*rel="canonical"[^>]*>/g;

/**
 * Las etiquetas de vista previa del <head> de un HTML propio (título,
 * descripción, canonical, og:* y twitter:*), en el orden en que aparecen.
 * `null` si no hay <head> completo o falta og:title: mejor el render normal que
 * una vista previa vacía.
 */
export function previewTags(html: string): string | null {
  const end = html.indexOf("</head>");
  if (end < 0) return null;
  const tags = html.slice(0, end).match(HEAD_TAG);
  if (!tags || !tags.some((tag) => tag.includes('property="og:title"'))) return null;
  return tags.join("");
}

/** Documento mínimo con esas etiquetas: lo que lee el crawler, sin cuerpo. */
export function previewDocument(tags: string, lang: string): string {
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/>${tags}</head><body></body></html>`;
}

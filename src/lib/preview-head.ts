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
 *
 * Las arma la ruta /api/preview-head y la CDN de Vercel guarda el resultado; el
 * proxy pide esa ruta, no la home. Hasta el 12/11/2026 el proxy pedía la home
 * él mismo y las guardaba en memoria una hora, pero el proxy corre en varias
 * regiones y en instancias que duran poco: en 12 horas, 143 visitas del crawler
 * dieron 122 renders de la home (user agent `pluma-preview-head`), casi uno por
 * visita. Con la CDN, la home se renderiza para esto una vez por región y día.
 */

/** Solo el crawler de vistas previas, no `meta-externalagent` (que lee contenido). */
export const PREVIEW_BOT = /facebookexternalhit/i;

/** Cuánto reusa el proxy el documento en memoria antes de volver a pedirlo. */
export const PREVIEW_TTL_MS = 60 * 60 * 1000;

/** La ruta que arma el documento (feature `previewBotHome`). */
export const PREVIEW_HEAD_PATH = "/api/preview-head";

/** Con este user agent la ruta pide la home, para que ese pedido no vuelva al proxy como crawler. */
export const PREVIEW_USER_AGENT = "pluma-preview-head";

/**
 * Un día en la CDN, y una semana sirviendo el viejo mientras renueva. Un deploy
 * nuevo arranca con la CDN vacía; un cambio de título o descripción desde el
 * admin tarda hasta un día en llegar a las vistas previas de Meta.
 */
export const PREVIEW_CDN_CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

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

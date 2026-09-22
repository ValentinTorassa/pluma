/**
 * Clave de página para el contador propio (feature `views`).
 *
 * Las páginas que no son artículos se cuentan por una clave de un conjunto
 * cerrado, no por el pathname crudo: el beacon lo manda el navegador y
 * cualquiera puede postear lo que se le ocurra, así que la cardinalidad no
 * puede depender de lo que llegue. Los hijos suman a su padre (`/apuntes/3` →
 * `apuntes`, `/serie/linux` → `series`, `/archivo/2026/09` → `archivo`): acá lo
 * que se quiere saber es cuánta gente entra, no qué número leyó.
 *
 * Los artículos no pasan por acá: siguen con `articleId` y `article_views`.
 * `/azar` tampoco, porque redirige a un artículo y lo cuenta el de allá.
 */
export const PAGE_KEYS = ["home", "acerca", "series", "apuntes", "archivo", "buscar"] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

/**
 * Primer segmento → clave, con la cantidad de segmentos que esa rama tiene de
 * verdad (`/archivo` y `/archivo/2026/09`, pero no `/archivo/2026`). Así un 404
 * dentro de la rama no suma: el not-found también pinta el footer.
 */
const ROUTES: Record<string, { key: PageKey; parts: number[] }> = {
  acerca: { key: "acerca", parts: [1] },
  buscar: { key: "buscar", parts: [1] },
  series: { key: "series", parts: [1] },
  serie: { key: "series", parts: [2] },
  apuntes: { key: "apuntes", parts: [1, 2] },
  archivo: { key: "archivo", parts: [1, 3] },
};

export function pageKey(pathname: string): PageKey | null {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "home";

  const route = ROUTES[parts[0] ?? ""];
  if (!route || !route.parts.includes(parts.length)) return null;
  return route.key;
}

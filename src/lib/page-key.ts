/**
 * Clave de página para el contador propio (feature `views`).
 *
 * Las páginas que no son artículos se cuentan por una clave de un conjunto
 * cerrado, no por el pathname crudo: el beacon lo manda el navegador y
 * cualquiera puede postear lo que se le ocurra, así que la cardinalidad no
 * puede depender de lo que llegue. Los hijos suman a su padre (`/serie/linux` →
 * `series`, `/archivo/2026/09` → `archivo`): acá lo que se quiere saber es
 * cuánta gente entra, no qué número leyó.
 *
 * La excepción es Apuntes: `/apuntes` es la página para anotarse y
 * `/apuntes/3` es un número para leer, así que van separadas (`apuntes` y
 * `apuntes-numero`, todos los números juntos). Antes de este cambio (octubre
 * de 2026) los números sumaban en `apuntes`: las filas de `page_views`
 * anteriores a su deploy mezclan las dos y no se pueden separar (no hubo
 * migración de datos). El primer día con una fila `apuntes-numero` marca el
 * corte.
 *
 * Los artículos no pasan por acá: siguen con `articleId` y `article_views`.
 * `/azar` tampoco, porque redirige a un artículo y lo cuenta el de allá.
 */
export const PAGE_KEYS = [
  "home",
  "acerca",
  "series",
  "apuntes",
  "apuntes-numero",
  "archivo",
  "buscar",
  "libro",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

/**
 * Primer segmento → clave según cuántos segmentos tiene la ruta, solo para las
 * formas que esa rama tiene de verdad (`/archivo` y `/archivo/2026/09`, pero no
 * `/archivo/2026`). Así un 404 dentro de la rama no suma: el not-found también
 * pinta el footer.
 */
const ROUTES: Record<string, Partial<Record<number, PageKey>>> = {
  acerca: { 1: "acerca" },
  buscar: { 1: "buscar" },
  series: { 1: "series" },
  serie: { 2: "series" },
  apuntes: { 1: "apuntes", 2: "apuntes-numero" },
  archivo: { 1: "archivo", 3: "archivo" },
  libro: { 1: "libro" },
};

export function pageKey(pathname: string): PageKey | null {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "home";

  // Object.hasOwn: `/constructor` o `/__proto__` no son ramas del sitio
  const first = parts[0] ?? "";
  if (!Object.hasOwn(ROUTES, first)) return null;
  return ROUTES[first]?.[parts.length] ?? null;
}

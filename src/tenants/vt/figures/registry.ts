/**
 * Figuras que el contenido puede usar con `::figure{name="…"}`. Es la allowlist
 * del pipeline: un nombre que no está acá no se renderiza.
 *
 * Hoy cada figura es un placeholder con su proporción. Cuando lleguen los
 * dibujos de la maqueta v3.1, cada entrada suma su componente (client) en
 * FigureSlot.tsx sin tocar el contenido de la base.
 */
export type FigureDefinition = {
  /** Descripción accesible (aria-label) */
  label: string;
  /** Ocupa la columna ancha del artículo */
  wide: boolean;
};

export const FIGURES = {
  "git-history": {
    label: "Cuatro commits de un repo: el .env entra en el segundo y sale del último, que es HEAD. Un clone se lleva todos.",
    wide: true,
  },
  "scanner-race": {
    label: "Línea de tiempo de 30 minutos desde el push: tres scanners leen la key y la usan antes de que te des cuenta.",
    wide: true,
  },
  "rotate-vs-clean": {
    label: "La key en el proveedor conectada con tres copias: tu repo, un fork y el clone de un bot. Rotar primero la invalida en todas.",
    wide: true,
  },
  chmod: {
    label: "Permisos de config.env: dueño, grupo y otros, cada uno con leer, escribir y ejecutar, y su valor octal.",
    wide: false,
  },
} as const satisfies Record<string, FigureDefinition>;

export type FigureName = keyof typeof FIGURES;

export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

export function isFigureName(name: string): name is FigureName {
  return Object.hasOwn(FIGURES, name);
}

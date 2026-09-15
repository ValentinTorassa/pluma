/**
 * Figuras que el contenido puede usar con `::figure{name="…"}`. Es la allowlist
 * del pipeline: un nombre que no está acá no se renderiza. Cada nombre tiene
 * su componente (client) en components/FigureSlot.tsx.
 */
export type FigureDefinition = {
  /** Descripción accesible (aria-label del dibujo) */
  label: string;
  /** Ocupa la columna ancha del artículo */
  wide: boolean;
  /** Pie por defecto (el de la maqueta) si la directiva no trae `caption` */
  caption?: string;
  /** aria-label de la versión chica del home, si la figura la tiene */
  mini?: string;
};

const DEFINITIONS = {
  "git-history": {
    label: "Cuatro commits de un repo: el .env entra en el segundo y sale del último, que es HEAD. Un clone se lleva todos.",
    wide: true,
    caption: "Repo de ejemplo. Cada hoja es la foto que guarda un commit.",
    mini: "Tres commits. El .env está en los dos primeros y sale del último, que es HEAD.",
  },
  "scanner-race": {
    label: "Línea de tiempo de 30 minutos desde el push: los scanners leen la key en los primeros 6 minutos y la usan cuatro veces antes de que te des cuenta. El tramo rojo es cuánto estuvo expuesta.",
    wide: true,
    caption: "Tiempos ilustrativos. Varían según el tipo de secreto.",
  },
  "rotate-vs-clean": {
    label: "La key en el proveedor conectada con tres copias: tu repo, un fork y el clone de un bot. Rotar primero la invalida en todas.",
    wide: true,
    caption: "Los minutos son un ejemplo: reescribir, forzar el push y avisarle al equipo lleva su rato.",
  },
  chmod: {
    label: "Permisos de config.env: dueño, grupo y otros, cada uno con leer, escribir y ejecutar, y su valor octal.",
    wide: false,
  },
} as const satisfies Record<string, FigureDefinition>;

export type FigureName = keyof typeof DEFINITIONS;

export const FIGURES: Record<FigureName, FigureDefinition> = DEFINITIONS;

export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

export function isFigureName(name: string): name is FigureName {
  return Object.hasOwn(FIGURES, name);
}

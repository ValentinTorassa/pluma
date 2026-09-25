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
    mini: "Línea de tiempo del push: los scanners leen la key a los 4 minutos y la usan cuatro veces antes de que te des cuenta.",
    caption: "Tiempos ilustrativos. Varían según el tipo de secreto.",
  },
  "rotate-vs-clean": {
    label: "La key en el proveedor conectada con tres copias: tu repo, un fork y el clone de un bot. Rotar primero la invalida en todas.",
    wide: true,
    mini: "La key del proveedor y las tres copias que la tienen: rotarla la invalida en todas a la vez.",
    caption: "Los minutos son un ejemplo: reescribir, forzar el push y avisarle al equipo lleva su rato.",
  },
  chmod: {
    label: "Permisos de config.env: dueño, grupo y otros, cada uno con leer, escribir y ejecutar, y su valor octal.",
    wide: false,
    mini: "Los nueve permisos de un archivo: 777 los abre todos y 640 deja sólo al dueño y al grupo.",
  },
  "bind-scope": {
    label: "Un servidor escuchando en el puerto 3000. En 0.0.0.0 otra máquina de la red se baja el .env; en 127.0.0.1 solo llega el navegador de la misma máquina. El router corta lo que viene de internet.",
    wide: true,
    caption: "Red de ejemplo. El router corta lo que entra de internet mientras nadie le abra el puerto.",
    mini: "Un puerto en 0.0.0.0 le contesta a otra máquina de la red; en 127.0.0.1, a nadie más.",
  },
  "term-vs-kill": {
    label: "Un programa atiende pedidos y cada tanto guarda en el disco. Con kill termina lo que tenía, guarda y borra su lock; con kill -9 el kernel lo saca: se cortan los pedidos a medio atender, se pierde lo que tenía en memoria y el lock queda.",
    wide: true,
    caption: "Programa y tiempos de ejemplo. No todos dejan un lock, pero cualquiera pierde lo que no alcanzó a escribir.",
  },
  respawn: {
    label: "Un cliente manda pedidos a un servicio que vigila systemd. Si matás el proceso, rebotan hasta que systemd lo levanta con otro PID; con systemctl stop rebotan todos.",
    wide: true,
    caption: "Los dos primeros PID son los de la prueba real; los que siguen, de ejemplo.",
  },
} as const satisfies Record<string, FigureDefinition>;

export type FigureName = keyof typeof DEFINITIONS;

export const FIGURES: Record<FigureName, FigureDefinition> = DEFINITIONS;

export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

export function isFigureName(name: string): name is FigureName {
  return Object.hasOwn(FIGURES, name);
}

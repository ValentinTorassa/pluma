/**
 * Artículo → su gemelo en Open Security Labs, con el link "Practicalo en el
 * lab" al final del artículo. Sale de la tabla de la especificación común
 * (2026-10-17); cada URL respondió 200 con curl ese día y el título es el H1
 * de esa página. Los artículos viven en la base: esto es un mapa por slug a
 * propósito, para no sumar una columna (ni una migración) por cuatro links.
 *
 * Un slug que no está acá no muestra nada. Si un lab cambia de URL, se cambia acá.
 */
export type LabTwin = { url: string; title: string };

const LAB_TWINS: Readonly<Record<string, LabTwin>> = {
  "permisos-chmod-777": {
    url: "https://securitylabs.valentorassa.com/labs/ciberseguridad/por-que-chmod-777/",
    title: "Por qué chmod 777 es un problema, no una solución",
  },
  "address-already-in-use": {
    url: "https://securitylabs.valentorassa.com/labs/linux-real/proceso-socket-evidencia-demo/",
    title: "Del proceso al socket: una investigación con datos de juguete",
  },
  "subiste-el-env-a-github": {
    url: "https://securitylabs.valentorassa.com/labs/devsecops-agentes/secret-scanning-token-al-repo/",
    title: "Secret scanning: el token que se te escapó al repo",
  },
  // La tabla dice "que-cuenta-como-experiencia"; el slug publicado es este.
  // No es un lab sino la página de portafolio de los Labs.
  "que-cuenta-como-experiencia-en-ciberseguridad": {
    url: "https://securitylabs.valentorassa.com/portafolio/",
    title: "Construí evidencia, no una lista de herramientas",
  },
};

export function labTwin(slug: string): LabTwin | null {
  return Object.hasOwn(LAB_TWINS, slug) ? LAB_TWINS[slug] : null;
}

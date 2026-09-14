import type { TenantConfig } from "../types";

/**
 * Yanina L. Colombero — https://yaninacolombero.com (producción).
 *
 * Los textos públicos del autor se pueden sobreescribir desde
 * /admin/configuracion (tabla `settings`); estos son los valores por defecto.
 *
 * REGLA: este tenant tiene que seguir idéntico a producción. `storagePrefix`,
 * `blobPrefix` y `sessionCookie` conservan los valores históricos de "pluma"
 * para no perder preferencias de lectoras, imágenes ni sesiones abiertas.
 */
export const config = {
  id: "yanina",
  siteName: "Pluma",
  siteDescription:
    "Artículos y análisis sobre psicología jurídica, forense y criminología.",
  locale: "es-AR",
  lang: "es",
  timeZone: "America/Argentina/Buenos_Aires",

  author: {
    name: "Yanina L. Colombero",
    role: "Lic. en Psicología · Psicología Forense y Criminología",
    bio: "Licenciada en Psicología (UCSE, sede Rafaela) con diplomatura en Criminalística y Criminología. Me dedico a la psicología jurídica y forense en la provincia de Santa Fe, Argentina: análisis, evaluación y rol de las pericias psicológicas penales en el sistema judicial provincial. También participo en talleres de estimulación cognitiva y salud mental para adultos en la región.",
    avatarUrl: "",
    email: "",
    linkedin: "",
  },

  pageSize: 10,
  commentBlacklist: ["http://", "https://", "www."],

  storagePrefix: "pluma",
  blobPrefix: "pluma/",
  sessionCookie: "pluma_session",

  features: {
    codeHighlight: false,
    callouts: false,
    rss: false,
    series: false,
    newsletter: false,
    apuntes: false,
    publicApi: false,
    readingTools: true,
  },
} as const satisfies TenantConfig;

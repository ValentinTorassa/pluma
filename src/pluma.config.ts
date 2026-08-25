/**
 * pluma — plataforma de blog open source para un solo autor.
 *
 * Editá este archivo para personalizar el sitio. No requiere base de datos
 * ni redeploy de código: cambiás los valores, subís, y listo.
 */
export const config = {
  /** Nombre del sitio (aparece en el header, título y SEO) */
  siteName: "Pluma",
  /** Descripción corta para SEO y el header */
  siteDescription:
    "Artículos y análisis sobre psicología jurídica, forense y criminología.",
  /** Idioma del sitio */
  locale: "es-AR",

  author: {
    name: "Yanina L. Colombero",
    role: "Lic. en Psicología · Psicología Forense y Criminología",
    bio: "Licenciada en Psicología (UCSE, sede Rafaela) con diplomatura en Criminalística y Criminología. Me dedico a la psicología jurídica y forense en la provincia de Santa Fe, Argentina: análisis, evaluación y rol de las pericias psicológicas penales en el sistema judicial provincial. También participo en talleres de estimulación cognitiva y salud mental para adultos en la región.",
    /** URL de foto de perfil (opcional). Podés subir una desde el admin y pegarla acá. */
    avatarUrl: "",
    /** Links opcionales (se muestran en el footer si existen) */
    email: "",
    linkedin: "",
  },

  /** Cantidad de artículos por página en el home */
  pageSize: 10,

  /** Palabras/frases prohibidas en comentarios (se rechazan automáticamente) */
  commentBlacklist: ["http://", "https://", "www."],
} as const;

export type PlumaConfig = typeof config;

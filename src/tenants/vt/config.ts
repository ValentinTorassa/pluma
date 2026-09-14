import type { TenantConfig } from "../types";

/**
 * VT Security — blog de ciberseguridad de Valentín Torassa.
 * Deployment propio (proyecto de Vercel, base Turso, Blob y secretos aparte)
 * con PLUMA_TENANT=vt. Diseño: maqueta v3 aprobada (VT-Blog-Design).
 */
export const config = {
  id: "vt",
  siteName: "VT Security",
  siteDescription:
    "Hago videos de ciberseguridad y acá escribo lo que en un video no entra: el mecanismo, paso a paso, con figuras que podés mover.",
  locale: "es-AR",
  lang: "es",
  timeZone: "America/Argentina/Buenos_Aires",

  author: {
    name: "Valentín Torassa",
    role: "VT Security en YouTube",
    bio: "Hago videos de ciberseguridad en YouTube y escribo sobre el mecanismo detrás de cada tema.",
    avatarUrl: "",
    email: "",
    linkedin: "https://www.linkedin.com/in/valetorassa/",
  },

  pageSize: 10,
  commentBlacklist: ["http://", "https://", "www."],

  storagePrefix: "vt",
  blobPrefix: "vt/",
  sessionCookie: "vt_session",

  features: {
    codeHighlight: true,
    callouts: true,
    rss: true,
    series: true,
    newsletter: true,
    quincena: true,
    // TODO(phase5): API de publicación con token (/api/v1/posts)
    publicApi: false,
    readingTools: false,
  },
} as const satisfies TenantConfig;

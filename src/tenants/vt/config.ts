import type { TenantConfig } from "../types";

/**
 * VT Security — blog de ciberseguridad de Valentín Torassa.
 * Deployment propio (proyecto de Vercel, base Turso, Blob y secretos aparte)
 * con PLUMA_TENANT=vt.
 *
 * TODO(phase4): bio, links y descripción definitivos.
 */
export const config = {
  id: "vt",
  siteName: "VT Security",
  siteDescription:
    "Educación en ciberseguridad en español: conceptos, laboratorios y análisis técnicos explicados paso a paso.",
  locale: "es-AR",
  lang: "es",
  timeZone: "America/Argentina/Buenos_Aires",

  author: {
    name: "Valentín Torassa",
    role: "Ciberseguridad",
    bio: "Escribo sobre seguridad informática en español.",
    avatarUrl: "",
    email: "",
    linkedin: "",
  },

  pageSize: 10,
  commentBlacklist: ["http://", "https://", "www."],

  storagePrefix: "vt",
  blobPrefix: "vt/",
  sessionCookie: "vt_session",

  // TODO(phase4): las features están marcadas pero todavía no implementadas.
  features: {
    codeHighlight: true,
    callouts: true,
    rss: true,
    series: true,
    newsletter: true,
    publicApi: true,
  },
} as const satisfies TenantConfig;

import type { TenantConfig } from "../types";
import type { BookSale } from "./lib/book-sale";

/**
 * VT Security - blog de ciberseguridad de Valentín Torassa.
 * Deployment propio (proyecto de Vercel, base Turso, Blob y secretos aparte)
 * con PLUMA_TENANT=vt. Diseño: maqueta v3 aprobada (VT-Blog-Design).
 */
export const config = {
  id: "vt",
  siteName: "VT Security",
  siteDescription: "Lo que voy aprendiendo de ciberseguridad y siento que vale la pena compartir con la comunidad.",
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
    agentAccess: true,
    rss: true,
    series: true,
    newsletter: true,
    apuntes: true,
    // Página del libro (/libro) con la lista de espera (NEWSLETTER_BOOK_LIST_UUIDS)
    book: true,
    // API de publicación para agentes (/api/v1; tokens con scripts/create-api-token.mjs)
    publicApi: true,
    readingTools: false,
    // Contador propio: alimenta VT-Content-Data-Lab desde la misma base
    views: true,
    // Contador agregado de comandle.valentorassa.com (POST /api/comandle, sin IP ni identificadores)
    comandleStats: true,
    // Violaciones de la CSP agregadas en csp_reports, para pasar a bloquear (/admin/csp)
    cspReports: true,
  },
} as const satisfies TenantConfig;

/**
 * El libro: en preparación (lista de espera) o a la venta. Con `status: "venta"`
 * y un `buyUrl` https, /libro muestra el precio y "Comprar" en lugar de la
 * lista de espera, cambian los textos de /libro, Sobre mí y la tarjeta de los
 * artículos, y /libro suma el JSON-LD Book + Offer. `price` va como se
 * muestra, en pesos: "$ 25.000". Los mismos campos que en ValenTorassa-Web.
 */
export const bookSale: BookSale = { status: "preparacion" };

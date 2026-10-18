/**
 * Identidad compartida entre valentorassa.com, este blog y Open Security Labs
 * (especificación común del 2026-10-17; los tres sitios usan exactamente esto).
 *
 * - El registro completo de la persona vive SOLO en https://valentorassa.com/.
 *   Acá se la referencia con la forma compacta (mismo @id), nunca entera.
 * - El registro completo de la organización vive en el home de este blog
 *   (`organization`); los artículos la referencian como publisher.
 *
 * Si algo cambia, cambia primero en la especificación y en los tres sitios a la vez.
 */

/** Autor de los artículos (forma compacta) */
export const personRef = {
  "@type": "Person",
  "@id": "https://valentorassa.com/#person",
  name: "Valentín Torassa Colombero",
  url: "https://valentorassa.com/",
} as const;

/** Publisher de los artículos (forma compacta) */
export const publisherRef = {
  "@type": "Organization",
  "@id": "https://vtsecurity.com.ar/#organization",
  name: "VT Security",
  url: "https://vtsecurity.com.ar/",
} as const;

/** Registro completo: solo en el home de este blog */
export const organization = {
  "@type": "Organization",
  "@id": "https://vtsecurity.com.ar/#organization",
  name: "VT Security",
  url: "https://vtsecurity.com.ar/",
  founder: { "@id": "https://valentorassa.com/#person" },
  sameAs: [
    "https://www.youtube.com/@vtcibersecurity",
    "https://www.instagram.com/vtsecurity/",
    "https://www.tiktok.com/@vtsecurity",
    "https://securitylabs.valentorassa.com/",
  ],
} as const;

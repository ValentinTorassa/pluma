import { config } from "@tenant/config";

/**
 * Open Graph pide el locale como idioma_TERRITORIO (`es_AR`). `config.locale`
 * es la etiqueta BCP 47 que usa Intl (`es-AR`), así que se convierte acá.
 */
export function ogLocale(locale: string): string {
  return locale.replace("-", "_");
}

/**
 * Open Graph del sitio (lo pone el layout). Next no mezcla `openGraph`: una
 * página que define el suyo reemplaza este entero, así que lo repite.
 */
export function siteOpenGraph() {
  return { siteName: config.siteName, locale: ogLocale(config.locale), type: "website" as const };
}

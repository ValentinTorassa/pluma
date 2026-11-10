import { bookSale, config } from "../config";
import { personRef } from "../identity";
import { links } from "../links";
import { copy } from "../messages";

/**
 * Estado de venta del libro. Los mismos campos y valores que en ValenTorassa-Web,
 * así los dos sitios se pasan a la venta con el mismo cambio.
 */
export type BookSale = {
  status: "preparacion" | "venta";
  /** Tal como se muestra, en pesos: "$ 25.000" (punto de miles, coma decimal) */
  price?: string;
  /** Link de compra; solo https */
  buyUrl?: string;
};

export type BookOffer = { buyUrl: string; price?: string };

/**
 * La oferta, si el libro está a la venta. `venta` sin un `buyUrl` https deja
 * todo como en preparación: sin link no hay botón de compra, y la lista de
 * espera sigue siendo la forma de enterarse.
 */
export function bookOffer(sale: BookSale = bookSale): BookOffer | null {
  if (sale.status !== "venta") return null;
  const buyUrl = sale.buyUrl?.trim() ?? "";
  if (!isHttps(buyUrl)) return null;
  const price = sale.price?.trim();
  return price ? { buyUrl, price } : { buyUrl };
}

function isHttps(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

const THOUSANDS = /^\d{1,3}(?:\.\d{3})+$/;

/**
 * El precio para schema.org (número con punto decimal, sin moneda):
 * "$ 25.000" → "25000", "$ 18.500,50" → "18500.50". null si no se entiende,
 * y entonces el Offer sale sin precio antes que con uno equivocado.
 */
export function schemaPrice(price: string): string | null {
  const number = price.replace(/[^\d.,]/g, "");
  const [whole, cents, ...rest] = number.split(",");
  if (rest.length || !whole) return null;
  if (cents !== undefined && cents !== "" && !/^\d{1,2}$/.test(cents)) return null;
  if (!/^\d+$/.test(whole) && !THOUSANDS.test(whole)) return null;
  const digits = whole.replace(/\./g, "");
  return cents ? `${digits}.${cents}` : digits;
}

/** Los textos que cambian cuando el libro pasa a la venta */
export function bookCopy(sale: BookSale = bookSale) {
  const m = copy.book;
  const offer = bookOffer(sale);
  if (!offer) {
    return {
      offer,
      eyebrow: m.eyebrow,
      metaDescription: m.metaDescription,
      card: { before: m.card.before, cta: m.card.cta },
      aboutDescription: copy.about.bookDescription,
    };
  }
  return {
    offer,
    eyebrow: m.sale.eyebrow,
    metaDescription: m.sale.metaDescription,
    card: { before: m.sale.card.before, cta: m.sale.card.cta },
    aboutDescription: m.sale.aboutDescription,
  };
}

/**
 * JSON-LD Book con su Offer (https://schema.org/Book), solo a la venta.
 * Mismo `@id` que el registro del libro en valentorassa.com/libro, para que
 * los buscadores los lean como el mismo libro.
 */
export function bookJsonLd({ sale = bookSale, image }: { sale?: BookSale; image?: string } = {}) {
  const offer = bookOffer(sale);
  if (!offer) return null;
  const price = offer.price ? schemaPrice(offer.price) : null;
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${links.book}#book`,
    name: copy.book.title,
    alternativeHeadline: copy.book.subtitle,
    inLanguage: config.lang,
    author: personRef,
    url: links.book,
    ...(image ? { image } : {}),
    offers: {
      "@type": "Offer",
      url: offer.buyUrl,
      ...(price ? { price } : {}),
      priceCurrency: "ARS",
      availability: "https://schema.org/InStock",
    },
  };
}

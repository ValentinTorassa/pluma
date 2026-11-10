import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookSale } from "@/tenants/vt/config";
import { bookCopy, bookJsonLd, bookOffer, schemaPrice, type BookSale } from "@/tenants/vt/lib/book-sale";

const venta: BookSale = { status: "venta", price: "$ 25.000", buyUrl: "https://tienda.example/libro" };

const person = {
  "@type": "Person",
  "@id": "https://valentorassa.com/#person",
  name: "Valentín Torassa Colombero",
  url: "https://valentorassa.com/",
};

/** /libro renderizado con `sale` como `bookSale` de config.ts */
async function renderBookPage(sale: BookSale) {
  vi.resetModules();
  vi.doMock("@/tenants/vt/config", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/tenants/vt/config")>()),
    bookSale: sale,
  }));
  const { bookPage } = await import("@/tenants/vt/pages/libro");
  const { BookCard } = await import("@/tenants/vt/components/BookCard");
  const { bookCopy: copyFromConfig } = await import("@/tenants/vt/lib/book-sale");
  const metadata = await bookPage.metadata!({} as never);
  return {
    html: renderToStaticMarkup(createElement(bookPage.Page, {} as never)),
    card: renderToStaticMarkup(createElement(BookCard)),
    about: copyFromConfig().aboutDescription,
    description: metadata.description,
  };
}

describe("vt: libro en preparación (config de hoy)", () => {
  it("bookSale arranca en preparación", () => {
    expect(bookSale).toEqual({ status: "preparacion" });
  });

  it("sin oferta ni JSON-LD", () => {
    expect(bookOffer()).toBeNull();
    expect(bookJsonLd()).toBeNull();
  });

  it("los textos son los de hoy", () => {
    expect(bookCopy()).toEqual({
      offer: null,
      eyebrow: "Libro · en preparación",
      metaDescription:
        "Un libro de Valentín Torassa Colombero sobre Linux, las abstracciones que fallan y el camino a la ciberseguridad. Está en preparación: anotate en la lista de espera.",
      card: { before: "Estoy escribiendo un libro: ", cta: "Anotate en la lista de espera" },
      aboutDescription: "El libro, en preparación: índice y lista de espera.",
    });
  });
});

describe("vt: libro a la venta", () => {
  it("la oferta trae el precio y el link", () => {
    expect(bookOffer(venta)).toEqual({ buyUrl: "https://tienda.example/libro", price: "$ 25.000" });
    expect(bookOffer({ ...venta, price: "  " })).toEqual({ buyUrl: "https://tienda.example/libro" });
  });

  it("cambian los textos: nada de preparación ni de lista de espera", () => {
    const text = bookCopy(venta);
    expect(text.eyebrow).toBe("Libro · ya disponible");
    expect(text.card).toEqual({ before: "Salió mi libro: ", cta: "Dónde conseguirlo" });
    for (const value of [text.eyebrow, text.metaDescription, text.card.before, text.card.cta, text.aboutDescription]) {
      expect(value).not.toMatch(/preparación|lista de espera/i);
    }
  });

  it("JSON-LD Book con su Offer en pesos, en stock, hacia el link de compra", () => {
    const data = JSON.parse(JSON.stringify(bookJsonLd({ sale: venta, image: "https://vtsecurity.com.ar/tapa.jpg" })));
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "Book",
      "@id": "https://valentorassa.com/libro#book",
      name: "No podés defender lo que no entendés",
      alternativeHeadline: "Linux, las abstracciones que fallan y el camino a la ciberseguridad",
      inLanguage: "es",
      author: person,
      url: "https://valentorassa.com/libro",
      image: "https://vtsecurity.com.ar/tapa.jpg",
      offers: {
        "@type": "Offer",
        url: "https://tienda.example/libro",
        price: "25000",
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock",
      },
    });
  });

  it("sin precio (o con uno que no se entiende), el Offer sale sin price", () => {
    expect(bookJsonLd({ sale: { ...venta, price: undefined } })?.offers).not.toHaveProperty("price");
    expect(bookJsonLd({ sale: { ...venta, price: "consultar" } })?.offers).not.toHaveProperty("price");
  });

  it.each([undefined, "", "   ", "tienda.example/libro", "http://tienda.example/libro", "javascript:alert(1)"])(
    "venta con buyUrl %j sigue como en preparación",
    (buyUrl) => {
      const sale: BookSale = { ...venta, buyUrl };
      expect(bookOffer(sale)).toBeNull();
      expect(bookJsonLd({ sale })).toBeNull();
      expect(bookCopy(sale)).toEqual(bookCopy({ status: "preparacion" }));
    },
  );
});

describe("vt: precio para schema.org", () => {
  it.each([
    ["$ 25.000", "25000"],
    ["25000", "25000"],
    ["$25.000,-", "25000"],
    ["ARS 18.500,50", "18500.50"],
    ["$ 1.234.567", "1234567"],
  ])("%j → %j", (price, expected) => {
    expect(schemaPrice(price)).toBe(expected);
  });

  it.each(["", "consultar", "25.5", "25,000.00", "1,2,3", "$ 25.00"])("%j no se entiende", (price) => {
    expect(schemaPrice(price)).toBeNull();
  });
});

describe("vt: /libro según bookSale", () => {
  afterEach(() => {
    vi.doUnmock("@/tenants/vt/config");
    vi.resetModules();
  });

  it("en preparación: lista de espera, sin Comprar ni JSON-LD", async () => {
    const page = await renderBookPage({ status: "preparacion", price: "$ 25.000", buyUrl: venta.buyUrl });
    expect(page.html).toContain("Libro · en preparación");
    expect(page.html).toContain('id="book-wait-h"');
    expect(page.html).toContain('id="nl-libro"');
    expect(page.html).not.toContain("Comprar");
    expect(page.html).not.toContain("application/ld+json");
    expect(page.card).toContain("Anotate en la lista de espera");
    expect(page.about).toBe("El libro, en preparación: índice y lista de espera.");
    expect(page.description).toMatch(/Está en preparación/);
  });

  it("a la venta: precio y Comprar en lugar del formulario, y el JSON-LD", async () => {
    const page = await renderBookPage(venta);
    expect(page.html).toContain("Libro · ya disponible");
    expect(page.html).not.toContain('id="nl-libro"');
    expect(page.html).not.toMatch(/preparación|lista de espera/i);
    expect(page.html).toContain('<p class="book-price"><span class="vh">Precio: </span>$ 25.000</p>');
    expect(page.html).toContain('<a class="btn" href="https://tienda.example/libro">Comprar</a>');
    const ld = page.html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(JSON.parse(ld ?? "null")).toMatchObject({
      "@type": "Book",
      offers: { url: "https://tienda.example/libro", price: "25000", priceCurrency: "ARS", availability: "https://schema.org/InStock" },
    });
    expect(page.card).toContain("Salió mi libro: ");
    expect(page.card).not.toContain("lista de espera");
    expect(page.about).toBe("El libro: índice y dónde comprarlo.");
    expect(page.description).toMatch(/Ya está a la venta/);
  });
});

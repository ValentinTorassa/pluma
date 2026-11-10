import type { Metadata } from "next";
import { ogLocale } from "@/lib/open-graph";
import type { TenantPage } from "../../types";
import cover from "../assets/libro/cover-540.jpg";
import ogImage from "../assets/libro/og.png";
import { BookCover } from "../components/BookCover";
import { JsonLd } from "../components/JsonLd";
import { NewsletterForm } from "../components/NewsletterForm";
import { config } from "../config";
import { links } from "../links";
import { bookCopy, bookJsonLd } from "../lib/book-sale";
import { alternates, siteUrl } from "../lib/seo";
import { copy } from "../messages";

const m = copy.book;

/**
 * /libro: el libro y su lista de espera (feature `book`); a la venta
 * (`bookSale` en config.ts), el precio y "Comprar" en lugar de la lista.
 * La página completa, con el índice, vive en valentorassa.com/libro: esta es
 * la versión corta para quien llega desde el blog, con canonical hacia allá.
 */
function BookPage() {
  const { offer, eyebrow } = bookCopy();
  const jsonLd = bookJsonLd({ image: `${siteUrl()}${cover.src}` });

  return (
    <div className="site">
      <div className="col page book">
        <div className="book-head">
          <div className="book-titles">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="t-display">{m.title}</h1>
            <p className="book-sub">{m.subtitle}</p>
          </div>
          <BookCover className="book-cover" sizes="(max-width: 640px) 150px, 200px" alt={m.coverAlt} priority />
        </div>

        <div className="book-pitch">
          {m.pitch.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section className="book-sec" aria-labelledby="book-points-h">
          <h2 className="t-h2" id="book-points-h">
            {m.pointsTitle}
          </h2>
          <ul className="book-points">
            {m.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        {offer ? (
          <section className="book-sec book-buy" aria-labelledby="book-buy-h">
            <h2 className="t-h2" id="book-buy-h">
              {m.sale.buyTitle}
            </h2>
            <p className="book-buy-lead">{m.sale.buyLead}</p>
            <div className="book-buy-row">
              {offer.price && (
                <p className="book-price">
                  <span className="vh">{m.sale.priceLabel}</span>
                  {offer.price}
                </p>
              )}
              <a className="btn" href={offer.buyUrl}>
                {m.sale.buy}
              </a>
            </div>
          </section>
        ) : (
          config.features.newsletter && (
            <section className="book-sec book-wait" aria-labelledby="book-wait-h">
              <h2 className="t-h2" id="book-wait-h">
                {m.waitlistTitle}
              </h2>
              <NewsletterForm id="nl-libro" list="libro" lead={m.waitlistLead} />
            </section>
          )
        )}

        <p className="book-more">
          <a className="textlink" href={links.book}>
            {m.more}
          </a>
        </p>
      </div>
      {jsonLd && <JsonLd data={jsonLd} />}
    </div>
  );
}

export const bookPage: TenantPage<Record<string, never>> = {
  Page: BookPage,
  metadata: async (): Promise<Metadata> => ({
    title: m.title,
    description: bookCopy().metaDescription,
    // La página canónica es la del sitio personal, que tiene el índice completo
    alternates: alternates(links.book),
    openGraph: {
      title: m.title,
      description: bookCopy().metaDescription,
      type: "website",
      siteName: config.siteName,
      locale: ogLocale(config.locale),
      url: links.book,
      images: [{ url: ogImage.src, width: ogImage.width, height: ogImage.height, alt: m.coverAlt }],
    },
  }),
};

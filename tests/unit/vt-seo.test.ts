import { afterEach, describe, expect, it } from "vitest";
import type { Article } from "@/db/schema";
import type { SiteSettings } from "@/lib/settings";
import { blogPostingJsonLd, organizationJsonLd } from "@/tenants/vt/lib/seo";

const site: SiteSettings = {
  authorName: "Valentín Torassa",
  authorRole: "",
  siteDescription: "Descripción del sitio.",
  authorBio: "",
  authorEmail: "",
  authorLinkedin: "",
  authorAvatar: "",
};

const article: Article = {
  id: "a1",
  slug: "permisos-chmod-777",
  title: "Permisos",
  excerpt: "Cómo leer `ls -l`.",
  content: "## Uno",
  coverImage: null,
  tags: "[]",
  status: "published",
  publishedAt: new Date("2026-09-02T13:00:00Z"),
  createdAt: new Date("2026-09-01T13:00:00Z"),
  updatedAt: new Date("2026-09-21T11:30:00Z"),
  seriesId: null,
  seriesOrder: null,
  issueNumber: null,
};

const person = {
  "@type": "Person",
  "@id": "https://valentorassa.com/#person",
  name: "Valentín Torassa Colombero",
  url: "https://valentorassa.com/",
};
const publisher = {
  "@type": "Organization",
  "@id": "https://vtsecurity.com.ar/#organization",
  name: "VT Security",
  url: "https://vtsecurity.com.ar/",
};

describe("vt: JSON-LD", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("BlogPosting completo, con autor y publisher de la identidad compartida", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vtsecurity.com.ar";
    const data = JSON.parse(JSON.stringify(blogPostingJsonLd(article, site, "/articulo/permisos-chmod-777")));
    const url = "https://vtsecurity.com.ar/articulo/permisos-chmod-777";
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Permisos",
      description: "Cómo leer ls -l.",
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      datePublished: "2026-09-02T13:00:00.000Z",
      dateModified: "2026-09-21T11:30:00.000Z",
      inLanguage: "es-AR",
      image: "https://vtsecurity.com.ar/api/og/permisos-chmod-777",
      author: person,
      publisher,
    });
  });

  it("sin bajada usa la descripción del sitio; sin publishedAt, la fecha de creación", () => {
    const data = blogPostingJsonLd({ ...article, excerpt: "", publishedAt: null }, site, "/articulo/x");
    expect(data.description).toBe("Descripción del sitio.");
    expect(data.datePublished).toBe("2026-09-01T13:00:00.000Z");
  });

  it("la organización del home es el registro completo de la especificación", () => {
    expect(JSON.parse(JSON.stringify(organizationJsonLd()))).toEqual({
      "@context": "https://schema.org",
      ...publisher,
      founder: { "@id": "https://valentorassa.com/#person" },
      sameAs: [
        "https://www.youtube.com/@vtcibersecurity",
        "https://www.instagram.com/vtsecurity/",
        "https://www.tiktok.com/@vtsecurity",
        "https://securitylabs.valentorassa.com/",
      ],
    });
  });
});

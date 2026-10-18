import { describe, expect, it } from "vitest";
import { contentToMarkdown } from "@/lib/content/to-markdown";
import { buildArticleMarkdown, buildLlmsFull, buildLlmsTxt } from "@/lib/llms";

const figures = { chmod: { label: "Los nueve casilleros.", caption: "Pie por defecto." }, solo: { label: "Descripción." } };
const md = (text: string) => contentToMarkdown(text, { directives: true, figures });

describe("contenido → Markdown para agentes", () => {
  it("las marcas en línea pasan a código o a texto", () => {
    expect(md("Un :key[.env] en :head[HEAD], :you[vos] y :safe[640].")).toBe(
      "Un `.env` en `HEAD`, vos y 640.",
    );
  });

  it("una figura deja su pie: el de la directiva, el del registro o la descripción", () => {
    expect(md('::figure{name="chmod" caption="Pie propio."}')).toBe("*Pie propio.*");
    expect(md('::figure{name="chmod"}')).toBe("*Pie por defecto.*");
    expect(md('::figure{name="solo"}')).toBe("*Descripción.*");
  });

  it("una figura que no está registrada no deja nada, como en el sitio", () => {
    expect(md('Antes.\n\n::figure{name="otra" caption="x"}\n\nDespués.')).toBe("Antes.\n\nDespués.");
  });

  it("aside es una cita y block lleva su label en negrita (con directivas adentro)", () => {
    expect(md(":::aside\n*Ojo.* Rotá la :key[key].\n:::")).toBe("> *Ojo.* Rotá la `key`.");
    expect(md(':::block{label="1 · Video"}\nTexto.\n:::\n\n::signoff[Nos leemos.]')).toBe(
      "**1 · Video**\n\nTexto.\n\nNos leemos.",
    );
  });

  it("una directiva desconocida vuelve a ser texto y no se escapa", () => {
    expect(md("A las hora:10 y Nota:importante.")).toBe("A las hora:10 y Nota:importante.");
  });

  it("código y tablas quedan como estaban", () => {
    expect(md("```bash\nchmod 640 a\n```")).toBe("```bash\nchmod 640 a\n```");
    expect(md("| a | b |\n| --- | --- |\n| :safe[1] | 2 |")).toBe("| a | b |\n| - | - |\n| 1 | 2 |");
  });

  it("sin directivas (feature callouts apagada) conserva las marcas como texto", () => {
    expect(contentToMarkdown("Un :key[.env]\n", { directives: false, figures: {} })).toBe("Un :key[.env]");
  });

  it("descarta HTML crudo igual que el artículo publicado, con o sin directivas", () => {
    for (const directives of [true, false]) {
      const result = contentToMarkdown("Visible. <script>alert(1)</script>\n\n<img src=x>\n\n`<b>código</b>`", { directives, figures: {} });
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<img");
      expect(result).toContain("Visible.");
      expect(result).toContain("`<b>código</b>`");
    }
  });
});

describe("/llms.txt", () => {
  it("H1, resumen en cita y secciones con enlaces; las vacías no salen", () => {
    const txt = buildLlmsTxt({
      title: "VT Security",
      summary: "Lo que voy aprendiendo.",
      sections: [
        {
          title: "Artículos",
          links: [{ title: "Permisos [y] más", url: "https://x.test/articulo/a", description: "Una\nbajada." }],
        },
        { title: "Apuntes", links: [] },
        { title: "Sobre el autor", links: [{ title: "YouTube", url: "https://www.youtube.com/@vtcibersecurity" }] },
      ],
    });
    expect(txt).toBe(
      [
        "# VT Security",
        "",
        "> Lo que voy aprendiendo.",
        "",
        "## Artículos",
        "",
        "- [Permisos \\[y\\] más](https://x.test/articulo/a): Una bajada.",
        "",
        "## Sobre el autor",
        "",
        "- [YouTube](https://www.youtube.com/@vtcibersecurity)",
        "",
      ].join("\n"),
    );
  });
});

describe("Markdown de un artículo y /llms-full.txt", () => {
  const doc = {
    title: 'Un "título"',
    excerpt: "La bajada.",
    url: "https://x.test/articulo/a",
    author: "Valentín Torassa",
    lang: "es-AR",
    datePublished: new Date("2026-09-02T13:00:00Z"),
    dateModified: new Date("2026-09-21T11:30:00Z"),
    body: "## Uno\n\nTexto.",
  };

  it("front matter con la URL canónica, título, bajada y cuerpo", () => {
    expect(buildArticleMarkdown(doc)).toBe(
      [
        "---",
        'title: "Un \\"título\\""',
        'description: "La bajada."',
        'canonical: "https://x.test/articulo/a"',
        'author: "Valentín Torassa"',
        'lang: "es-AR"',
        'datePublished: "2026-09-02T13:00:00.000Z"',
        'dateModified: "2026-09-21T11:30:00.000Z"',
        "---",
        "",
        '# Un "título"',
        "",
        "> La bajada.",
        "",
        "## Uno",
        "",
        "Texto.",
        "",
      ].join("\n"),
    );
  });

  it("llms-full: cada artículo con su URL canónica en el título", () => {
    const full = buildLlmsFull({ title: "VT Security", summary: "", articles: [doc, { ...doc, excerpt: "" }] });
    expect(full.split("\n---\n").length).toBe(3);
    expect(full).toContain('# [Un "título"](https://x.test/articulo/a)\n\n> La bajada.\n\n## Uno');
  });
});

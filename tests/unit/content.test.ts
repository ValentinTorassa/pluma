import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";
import { figureNames, processContent, type ContentOptions } from "@/lib/content/pipeline";

const options: ContentOptions = {
  figures: ["git-history", "chmod"],
  highlight: false,
  anchors: true,
  anchorLabel: "Enlace a esta sección",
  codeLabels: { bash: "terminal" },
  codeFallbackLabel: "código",
};

async function html(md: string, extra: Partial<ContentOptions> = {}) {
  const { tree } = await processContent(md, { ...options, ...extra });
  return toHtml(tree);
}

describe("content pipeline: sanitización", () => {
  it("descarta HTML crudo, scripts y handlers", async () => {
    const out = await html('Hola <script>alert(1)</script><img src=x onerror="alert(1)"> <b onclick="x">b</b>');
    expect(out).not.toMatch(/<script|onerror|onclick|<img|<b/);
    expect(out).toContain("Hola");
  });

  it("saca los protocolos peligrosos de los links", async () => {
    const out = await html("[a](javascript:alert(1)) [b](https://example.com)");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://example.com"');
  });

  it("solo convierte figuras registradas y sin atributos extra", async () => {
    const out = await html('::figure{name="git-history" caption="Repo" onclick="x" class="evil"}\n\n::figure{name="nope"}');
    expect(out).toContain('<pluma-figure figure="git-history" caption="Repo"></pluma-figure>');
    expect(out).not.toMatch(/nope|onclick|evil/);
  });

  it("ignora clases que no están en el schema aunque vengan de una directiva", async () => {
    const out = await html(':key[.env]{.evil} y :you[vos]');
    expect(out).toContain('<code class="c-key">.env</code>');
    expect(out).toContain('<span class="c-you">vos</span>');
    expect(out).not.toContain("evil");
  });

  it("restaura como texto las directivas desconocidas", async () => {
    const out = await html("Nos vemos a las 10:30, Nota:importante.\n\n::video{src=x}\n\n:::raro\n**hola**\n:::");
    expect(out).toContain("10:30");
    expect(out).toContain("Nota:importante.");
    expect(out).toContain("::video");
    expect(out).toContain("<strong>hola</strong>");
    expect(out).not.toMatch(/<raro|<video/);
  });

  it("aside, block y signoff generan solo sus clases fijas", async () => {
    const out = await html(':::aside\n*Ojo.* Texto.\n:::\n\n:::block{label="1 · Video"}\n## Título\n:::\n\n::signoff[Chau]');
    expect(out).toContain('<aside class="aside"><p><em>Ojo.</em> Texto.</p></aside>');
    expect(out).toContain('<section class="issue-block"><p class="eyebrow">1 · Video</p>');
    expect(out).toContain('<p class="signoff">Chau</p>');
  });
});

describe("content pipeline: títulos y código", () => {
  it("ids estables, anchors y títulos repetidos", async () => {
    const { tree, headings } = await processContent("## El archivo\n\n## Rotar primero\n\n## El archivo", options);
    expect(headings.map((h) => h.id)).toEqual(["el-archivo", "rotar-primero", "el-archivo-2"]);
    expect(toHtml(tree)).toContain('<h2 id="el-archivo">El archivo <a class="anchor" href="#el-archivo" aria-label="Enlace a esta sección">#</a></h2>');
  });

  it("envuelve bloques de código con etiqueta y botón de copiar", async () => {
    const out = await html('```yaml title=".pre-commit-config.yaml"\nrepos: []\n```\n\n```bash\ngit log\n```');
    expect(out).toContain('<div class="codeblock-top"><span>.pre-commit-config.yaml</span><pluma-copy></pluma-copy></div>');
    expect(out).toContain("<span>terminal</span>");
    expect(out).not.toContain("data-meta");
  });

  it("resalta con Shiki usando variables CSS", async () => {
    const out = await html("```yaml\nrepos:\n  - repo: x\n```", { highlight: true });
    expect(out).toContain("data-rehype-pretty-code-figure");
    expect(out).toMatch(/style="--shiki-|color:var\(--shiki-/);
    expect(out).toContain('class="codeblock"');
  });

  it("figureNames lista las figuras en orden", () => {
    expect(figureNames('texto\n::figure{name="git-history"}\n\n::figure{name=chmod caption="x"}')).toEqual([
      "git-history",
      "chmod",
    ]);
  });
});

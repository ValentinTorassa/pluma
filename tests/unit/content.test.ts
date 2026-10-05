import { toHtml } from "hast-util-to-html";
import { bundledLanguagesInfo } from "shiki";
import { describe, expect, it } from "vitest";
import { HIGHLIGHT_LANGUAGES } from "@/lib/content/languages";
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
    const out = await html('```yaml title="x.yaml"\nrepos:\n  - repo: x\n```', { highlight: true });
    expect(out).toContain("data-rehype-pretty-code-figure");
    // el título va solo en la cabecera del bloque, no duplicado por pretty-code
    expect(out).not.toContain("data-rehype-pretty-code-title");
    expect(out.match(/x\.yaml/g)).toHaveLength(1);
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

describe("content pipeline: lenguajes de Shiki", () => {
  const block = (lang: string, code: string) => html("```" + lang + "\n" + code + "\n```", { highlight: true });

  it("resalta los lenguajes de la lista, también por sus alias", async () => {
    const samples: [string, string][] = [
      ["bash", "echo hola # saludo"],
      ["sh", "export A=1"],
      ["console", "$ ls -la"],
      ["yml", "on: [push]"],
      ["dockerfile", "FROM alpine:3.20"],
      ["ps1", "Get-ChildItem -Force"],
      ["ts", "const a: number = 1;"],
      ["py", "def f(x): return x"],
      ["md", "Ver [la guía](https://example.com)."],
      ["nginx", "server { listen 80; }"],
    ];
    for (const [lang, code] of samples) {
      const out = await block(lang, code);
      expect(out, lang).toContain(`<pre tabindex="0" data-language="${lang}" data-theme="pluma-css-variables">`);
      expect(out, lang).toMatch(/color:var\(--shiki-token-/);
    }
  });

  it("un lenguaje fuera de la lista sale sin colores, con el mismo marcado y el texto escapado", async () => {
    for (const lang of ["cobol", "lenguaje-inventado", "constructor", "__proto__"]) {
      const out = await block(lang, 'DISPLAY "<b>hola</b>" & X');
      expect(out, lang).toContain(
        `<div class="codeblock"><div class="codeblock-top"><span>${lang}</span><pluma-copy></pluma-copy></div>`,
      );
      expect(out, lang).toContain(`<pre tabindex="0" data-language="${lang}" data-theme="pluma-css-variables">`);
      expect(out, lang).toContain('<span data-line=""><span>DISPLAY "&#x3C;b>hola&#x3C;/b>" &#x26; X</span></span>');
      expect(out, lang).not.toContain("--shiki-token-");
    }

    const inline = await html("`PERFORM X{:cobol}` y `const a = 1{:js}`", { highlight: true });
    expect(inline).toContain(
      '<code data-language="cobol" data-theme="pluma-css-variables"><span data-line=""><span>PERFORM X</span></span></code>',
    );
    expect(inline).toMatch(/data-language="js"[^]*--shiki-token-keyword/);
  });

  it("la lista tiene solo ids de Shiki e incluye lo que embebe cada uno", async () => {
    const allowed = new Set<string>(HIGHLIGHT_LANGUAGES);
    for (const id of HIGHLIGHT_LANGUAGES) {
      const info = bundledLanguagesInfo.find((l) => l.id === id);
      expect(info, id).toBeDefined();
      const { default: grammars } = await info!.import();
      for (const g of grammars) expect(allowed.has(g.name), `${id} embebe ${g.name}`).toBe(true);
    }
  });
});

/**
 * Markdown de la base → Markdown estándar, para agentes (/articulo/<slug>.md y
 * /llms-full.txt).
 *
 * Mismo parseo que el sitio (remark-parse + gfm + directive) y las mismas
 * reglas que src/lib/content/directives.ts, pero en lugar de elementos HTML
 * las directivas pasan a nodos de Markdown común:
 *
 *   ::figure{name=… caption=…}  → el pie en cursiva (el de la directiva, si no
 *                                 el del registro, si no la descripción); la
 *                                 figura es interactiva y no tiene versión en texto
 *   :::aside … :::              → cita (>)
 *   :::block{label=…} … :::     → el label en negrita y el contenido
 *   ::signoff[…]                → párrafo
 *   :key[x]  :head[x]           → `x` (en el sitio también son <code>)
 *   :you :safe :scan :exp       → el texto, sin marca
 *   directiva desconocida       → texto, igual que en el sitio
 *
 * El HTML crudo se descarta en ambos tenants, igual que en la página HTML.
 */
import type { BlockContent, Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify, { type Options as StringifyOptions } from "remark-stringify";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { TEXT_MARKS } from "./directives";

/** Figura registrada por el tenant: descripción accesible y pie por defecto */
export type FigureText = { label: string; caption?: string };

export type MarkdownOptions = {
  /** El tenant usa directivas (feature `callouts`) */
  directives: boolean;
  /** Figuras registradas; una que no esté se descarta, como en el sitio */
  figures: Readonly<Record<string, FigureText>>;
};

type Directive = ContainerDirective | LeafDirective | TextDirective;

const CODE_MARKS = new Set(["key", "head"]);

function textOf(node: { value?: unknown; children?: unknown[] }): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map((c) => textOf(c as { value?: unknown; children?: unknown[] })).join("");
}

function paragraph(children: PhrasingContent[]): Paragraph {
  return { type: "paragraph", children };
}

function replacement(d: Directive, figures: MarkdownOptions["figures"]): RootContent[] {
  const attrs = d.attributes ?? {};

  if (d.type === "leafDirective" && d.name === "figure") {
    const name = attrs.name ?? "";
    if (!Object.hasOwn(figures, name)) return [];
    const figure = figures[name];
    const text = ((attrs.caption ?? "").trim() || figure.caption || figure.label).slice(0, 300);
    return [paragraph([{ type: "emphasis", children: [{ type: "text", value: text }] }])];
  }
  if (d.type === "containerDirective" && d.name === "aside") {
    return [{ type: "blockquote", children: d.children as BlockContent[] }];
  }
  if (d.type === "containerDirective" && d.name === "block") {
    const label = (attrs.label ?? "").trim().slice(0, 120);
    const head = label ? [paragraph([{ type: "strong", children: [{ type: "text", value: label }] }])] : [];
    return [...head, ...(d.children as RootContent[])];
  }
  if (d.type === "leafDirective" && d.name === "signoff") {
    return [paragraph(d.children as PhrasingContent[])];
  }
  if (d.type === "textDirective" && Object.hasOwn(TEXT_MARKS, d.name)) {
    return CODE_MARKS.has(d.name)
      ? [{ type: "inlineCode", value: textOf(d) }]
      : (d.children as RootContent[]);
  }

  // Desconocida: se restaura como texto, igual que en el sitio
  const name: PhrasingContent = { type: "text", value: `${d.type === "textDirective" ? ":" : "::"}${d.name}` };
  if (d.type === "textDirective") return [name, ...(d.children as PhrasingContent[])];
  if (d.type === "leafDirective") return [paragraph([name, ...(d.children as PhrasingContent[])])];
  return d.children as RootContent[];
}

function remarkPlainDirectives(options: { figures: MarkdownOptions["figures"] }) {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== "containerDirective" && node.type !== "leafDirective" && node.type !== "textDirective") {
        return;
      }
      if (!parent || index === undefined) return;
      const nodes = replacement(node as Directive, options.figures);
      parent.children.splice(index, 1, ...(nodes as never[]));
      // Se sigue desde el mismo índice: los nodos nuevos también se recorren
      // (una directiva dentro de un :::aside, por ejemplo)
      return [SKIP, index];
    });
  };
}

function dropRawHtml(tree: Root): boolean {
  let dropped = false;
  visit(tree, "html", (_node, index, parent) => {
    if (!parent || index === undefined) return;
    parent.children.splice(index, 1);
    dropped = true;
    return [SKIP, index];
  });
  return dropped;
}

const stringifyOptions: StringifyOptions = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fences: true,
  rule: "-",
  listItemIndent: "one",
};

export function contentToMarkdown(markdown: string, options: MarkdownOptions): string {
  const parser = unified()
    .use(remarkParse)
    .use(remarkGfm);
  if (options.directives) {
    parser.use(remarkDirective).use(remarkPlainDirectives, { figures: options.figures });
  }
  const tree = parser.runSync(parser.parse(markdown)) as Root;
  const droppedHtml = dropRawHtml(tree);
  if (!options.directives && !droppedHtml) return markdown.trim();

  // Sin remark-directive al escribir: un "hora:10" del texto sale tal cual, sin escapar
  const writer = unified().use(remarkStringify, stringifyOptions).use(remarkGfm, { tablePipeAlign: false });
  return writer.stringify(tree).trim();
}

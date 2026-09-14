/**
 * Plugins de remark/rehype propios del pipeline de contenido.
 * Los de rehype corren después de sanitizar (árbol confiable).
 */
import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import { visit } from "unist-util-visit";
import { headingId } from "@/lib/headings";

export const COPY_TAG = "pluma-copy";

/** Texto plano de un nodo hast */
export function textOf(node: ElementContent | HastRoot): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map((c) => textOf(c as ElementContent)).join("");
  return "";
}

/** Pasa el meta del bloque de código (```yaml title="x.yaml") a un atributo que sobrevive a sanitize */
export function remarkCodeMeta() {
  return (tree: MdastRoot) => {
    visit(tree, "code", (node) => {
      if (!node.meta) return;
      node.data ??= {};
      node.data.hProperties = { ...node.data.hProperties, dataMeta: node.meta.slice(0, 200) };
    });
  };
}

export type CodeBlockOptions = {
  /** Etiqueta por lenguaje ("bash" → "terminal"); si no hay, se muestra el lenguaje */
  labels: Record<string, string>;
  fallbackLabel: string;
};

/**
 * Envuelve cada <pre><code> en el bloque de la maqueta:
 * <div class="codeblock"><div class="codeblock-top"><span>archivo</span><pluma-copy/></div><pre>…</pre></div>
 * El título sale de `title="…"` en el meta; si no, de la etiqueta del lenguaje.
 */
export function rehypeCodeBlocks(options: CodeBlockOptions) {
  return (tree: HastRoot) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!code) return;

      const classes = (code.properties.className as string[] | undefined) ?? [];
      const lang = classes.find((c) => c.startsWith("language-"))?.slice("language-".length) ?? "";
      const rawMeta = typeof code.properties.dataMeta === "string" ? code.properties.dataMeta : "";
      delete code.properties.dataMeta;
      const title = rawMeta.match(/title="([^"]{1,120})"/)?.[1];
      const meta = rawMeta.replace(/title="[^"]*"/, "").trim();
      // rehype-pretty-code lee el meta de acá (sin el título: lo mostramos nosotros).
      // Se pisa siempre: remark-rehype ya dejó el meta original (con title) en data.
      code.data = { ...code.data, meta: meta || undefined };

      const label = title ?? options.labels[lang] ?? (lang || options.fallbackLabel);
      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["codeblock"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["codeblock-top"] },
            children: [
              { type: "element", tagName: "span", properties: {}, children: [{ type: "text", value: label }] },
              { type: "element", tagName: COPY_TAG, properties: {}, children: [] },
            ],
          },
          node,
        ],
      };
      parent.children[index] = wrapper;
      return "skip";
    });
  };
}

/** Tablas GFM dentro de un contenedor con scroll horizontal (`.table-wrap`) */
export function rehypeTables() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrap"] },
        children: [node],
      };
      return "skip";
    });
  };
}

export type Heading = { id: string; text: string };

export type HeadingOptions = {
  /** Agrega el enlace "#" a cada h2 */
  anchors: boolean;
  anchorLabel: string;
  onHeading: (h: Heading) => void;
};

/** ids estables en h2/h3 (mismo slug que src/lib/headings.ts) y anchor "#" en los h2 */
export function rehypeHeadings(options: HeadingOptions) {
  return (tree: HastRoot) => {
    const used = new Map<string, number>();
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const text = textOf(node).trim();
      const base = headingId(text) || "seccion";
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n + 1}`;
      node.properties.id = id;

      if (node.tagName !== "h2") return;
      options.onHeading({ id, text });
      if (options.anchors) {
        node.children.push(
          { type: "text", value: " " },
          {
            type: "element",
            tagName: "a",
            properties: { className: ["anchor"], href: `#${id}`, ariaLabel: options.anchorLabel },
            children: [{ type: "text", value: "#" }],
          },
        );
      }
    });
  };
}

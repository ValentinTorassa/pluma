/**
 * Directivas de Markdown permitidas en el contenido (remark-directive).
 *
 * El contenido viene de la base: lo escribe la autora pero se trata como NO
 * confiable. Solo estas directivas se convierten en elementos; cualquier otra
 * vuelve a ser texto literal. Nada ejecuta código: cada directiva se mapea a un
 * elemento fijo con atributos de texto, y después pasa por rehype-sanitize.
 *
 *   ::figure{name="git-history" caption="Repo de ejemplo."}   figura registrada
 *   :::aside … :::                                            nota al margen
 *   :::block{label="1 · Video de la quincena"} … :::           bloque de un envío
 *   ::signoff[Nos leemos en dos semanas.]                     despedida
 *   :key[.env]  :head[HEAD]  :you[vos]  :safe[Rotar]  :scan[scanners]  :exp[ventana]
 */
import type { Root, Paragraph, PhrasingContent, RootContent, Text } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import { visit, SKIP } from "unist-util-visit";

/** Marcas en línea → elemento y clase (la clase tiene que estar en el schema de sanitize) */
export const TEXT_MARKS = {
  key: { tag: "code", className: "c-key" },
  head: { tag: "code", className: "c-head" },
  you: { tag: "span", className: "c-you" },
  safe: { tag: "span", className: "c-safe" },
  scan: { tag: "span", className: "c-scan" },
  exp: { tag: "span", className: "c-exp" },
} as const;

export const FIGURE_TAG = "pluma-figure";

type Directive = ContainerDirective | LeafDirective | TextDirective;

export type DirectiveOptions = {
  /** Nombres de figura permitidos (registro del tenant). Otros nombres se descartan. */
  figures: readonly string[];
};

function asText(node: Directive): Text {
  return { type: "text", value: `${node.type === "textDirective" ? ":" : "::"}${node.name}` };
}

export function remarkPlumaDirectives(options: DirectiveOptions) {
  const figures = new Set(options.figures);

  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (
        node.type !== "containerDirective" &&
        node.type !== "leafDirective" &&
        node.type !== "textDirective"
      ) {
        return;
      }
      if (!parent || index === undefined) return;
      const d = node as Directive;
      const attrs = d.attributes ?? {};
      const data = (d.data ??= {});

      if (d.type === "leafDirective" && d.name === "figure") {
        const name = attrs.name ?? "";
        if (!figures.has(name)) {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
        data.hName = FIGURE_TAG;
        data.hProperties = { figure: name, caption: (attrs.caption ?? "").slice(0, 300) };
        d.children = [];
        return SKIP;
      }

      if (d.type === "containerDirective" && d.name === "aside") {
        data.hName = "aside";
        data.hProperties = { className: ["aside"] };
        return;
      }

      if (d.type === "containerDirective" && d.name === "block") {
        data.hName = "section";
        data.hProperties = { className: ["issue-block"] };
        const label = (attrs.label ?? "").trim();
        if (label) {
          const eyebrow: Paragraph = {
            type: "paragraph",
            data: { hProperties: { className: ["eyebrow"] } },
            children: [{ type: "text", value: label.slice(0, 120) }],
          };
          d.children.unshift(eyebrow);
        }
        return;
      }

      if (d.type === "leafDirective" && d.name === "signoff") {
        data.hName = "p";
        data.hProperties = { className: ["signoff"] };
        return;
      }

      if (d.type === "textDirective" && d.name in TEXT_MARKS) {
        const mark = TEXT_MARKS[d.name as keyof typeof TEXT_MARKS];
        data.hName = mark.tag;
        data.hProperties = { className: [mark.className] };
        return;
      }

      // Directiva desconocida: se restaura como texto (p. ej. "hora:10" o "Nota:importante")
      if (d.type === "textDirective") {
        const replacement: PhrasingContent[] = [asText(d), ...(d.children as PhrasingContent[])];
        parent.children.splice(index, 1, ...(replacement as never[]));
        return [SKIP, index + replacement.length];
      }
      if (d.type === "leafDirective") {
        const p: Paragraph = { type: "paragraph", children: [asText(d), ...d.children] };
        parent.children.splice(index, 1, p as never);
        return [SKIP, index + 1];
      }
      // contenedor desconocido: se queda el contenido, sin envoltorio
      parent.children.splice(index, 1, ...(d.children as RootContent[] as never[]));
      return [SKIP, index];
    });
  };
}

/** Nombres de figuras usados en un texto, en orden (para "3 figuras" y la figura del home). */
export function figureNames(markdown: string): string[] {
  return [...markdown.matchAll(/^::figure\{[^}]*\bname="?([a-z0-9-]+)"?[^}]*\}/gm)].map((m) => m[1]);
}

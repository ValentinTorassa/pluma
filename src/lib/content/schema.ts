/**
 * Schema de rehype-sanitize para el contenido de la base.
 *
 * Parte del schema por defecto (el de GitHub) y suma SOLO lo que generan las
 * directivas permitidas (ver directives.ts). El HTML crudo del Markdown ya se
 * descarta antes (remark-rehype sin allowDangerousHtml); esto es la segunda
 * barrera: ningún elemento, atributo, clase o protocolo fuera de esta lista
 * llega al render. El resaltado de sintaxis y los anchors de títulos corren
 * DESPUÉS de sanitizar, sobre un árbol ya confiable.
 */
import { defaultSchema, type Options as Schema } from "rehype-sanitize";
import { FIGURE_TAG, TEXT_MARKS } from "./directives";

const marksFor = (tag: "code" | "span") =>
  Object.values(TEXT_MARKS)
    .filter((m) => m.tag === tag)
    .map((m) => m.className);

export const contentSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), FIGURE_TAG, "aside", "section"],
  attributes: {
    ...defaultSchema.attributes,
    [FIGURE_TAG]: ["figure", "caption"],
    aside: [["className", "aside"]],
    section: [["className", "issue-block"]],
    p: [["className", "eyebrow", "signoff"]],
    span: [["className", ...marksFor("span")]],
    // language-* lo usa el resaltado; dataMeta lleva el `title="…"` del bloque
    code: [["className", /^language-[\w+#-]+$/, ...marksFor("code")], "dataMeta"],
  },
};

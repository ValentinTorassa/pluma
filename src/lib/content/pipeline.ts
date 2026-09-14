/**
 * Markdown de la base → árbol hast seguro (+ títulos para el índice).
 *
 * Orden (lo importante es que sanitize va antes que todo lo que agrega HTML):
 *   remark-parse → remark-gfm → remark-directive → directivas permitidas
 *   → remark-rehype (descarta HTML crudo) → rehype-sanitize (schema.ts)
 *   → bloques de código → ids/anchors de títulos → Shiki (rehype-pretty-code)
 *
 * El árbol se convierte a React en el tenant (hast-util-to-jsx-runtime), que
 * mapea los elementos `pluma-figure` y `pluma-copy` a componentes propios.
 * No hay MDX ni evaluación de código: la sintaxis es Markdown + directivas.
 */
import type { Root as HastRoot } from "hast";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSanitize from "rehype-sanitize";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createCssVariablesTheme } from "shiki";
import { unified } from "unified";
import { remarkPlumaDirectives } from "./directives";
import {
  rehypeCodeBlocks,
  rehypeHeadings,
  rehypeTables,
  remarkCodeMeta,
  type Heading,
} from "./plugins";
import { contentSchema } from "./schema";

export { figureNames, FIGURE_TAG } from "./directives";
export { COPY_TAG, type Heading } from "./plugins";

/**
 * Tema de Shiki con variables CSS (`--shiki-token-*`): los colores los define
 * el theme.css del tenant a partir de sus tokens, así que claro/oscuro sale solo.
 */
const cssVariablesTheme = createCssVariablesTheme({
  name: "pluma-css-variables",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

export type ContentOptions = {
  /** Figuras registradas por el tenant (allowlist de `::figure{name=…}`) */
  figures: readonly string[];
  /** Resaltado de sintaxis con Shiki (feature `codeHighlight`) */
  highlight: boolean;
  /** Enlace "#" en los h2 */
  anchors: boolean;
  anchorLabel: string;
  codeLabels: Record<string, string>;
  codeFallbackLabel: string;
};

export async function processContent(
  markdown: string,
  options: ContentOptions,
): Promise<{ tree: HastRoot; headings: Heading[] }> {
  const headings: Heading[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkPlumaDirectives, { figures: options.figures })
    .use(remarkCodeMeta)
    .use(remarkRehype)
    .use(rehypeSanitize, contentSchema)
    .use(rehypeCodeBlocks, { labels: options.codeLabels, fallbackLabel: options.codeFallbackLabel })
    .use(rehypeTables)
    .use(rehypeHeadings, {
      anchors: options.anchors,
      anchorLabel: options.anchorLabel,
      onHeading: (h) => headings.push(h),
    });

  if (options.highlight) {
    const prettyCode: PrettyCodeOptions = {
      theme: cssVariablesTheme as PrettyCodeOptions["theme"],
      keepBackground: false,
      defaultLang: { block: "plaintext" },
    };
    processor.use(rehypePrettyCode, prettyCode);
  }

  const tree = (await processor.run(processor.parse(markdown))) as HastRoot;
  return { tree, headings };
}

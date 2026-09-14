import { toJsxRuntime, type Components, type Jsx } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { COPY_TAG, FIGURE_TAG, processContent } from "@/lib/content/pipeline";
import { config } from "../config";
import { FIGURE_NAMES } from "../figures/registry";
import { copy } from "../messages";
import { CopyButton } from "./CopyButton";
import { FigureSlot } from "./FigureSlot";

/**
 * Los únicos elementos "especiales" del contenido: los genera el pipeline
 * (allowlist + sanitize) y acá se mapean a componentes. No hay otra forma de
 * que el contenido de la base instancie un componente.
 */
const components = {
  [FIGURE_TAG]: (props: { figure?: string; caption?: string }) => (
    <FigureSlot name={props.figure ?? ""} caption={props.caption || undefined} />
  ),
  [COPY_TAG]: () => <CopyButton />,
} as unknown as Partial<Components>;

/** Markdown de la base → elementos React + títulos h2 para el índice */
export async function renderContent(markdown: string, { anchors }: { anchors: boolean }) {
  const { tree, headings } = await processContent(markdown, {
    figures: config.features.callouts ? FIGURE_NAMES : [],
    highlight: config.features.codeHighlight,
    anchors,
    anchorLabel: copy.article.anchor,
    codeLabels: copy.article.codeLabels,
    codeFallbackLabel: copy.article.codeFallback,
  });

  const element = toJsxRuntime(tree, {
    Fragment,
    jsx: jsx as Jsx,
    jsxs: jsxs as Jsx,
    components,
    passKeys: true,
  });

  return { element, headings };
}

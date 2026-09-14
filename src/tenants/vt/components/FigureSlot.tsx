import { FIGURES, isFigureName } from "../figures/registry";
import { copy } from "../messages";

type Variant = "article" | "inline" | "mini";

/**
 * Lugar de una figura interactiva. Por ahora dibuja un placeholder con la
 * proporción de la figura de la maqueta.
 *
 * TODO(v3.1): mapear cada nombre a su componente, p. ej.
 *   const COMPONENTS = { "git-history": GitHistoryFigure, … };
 * y renderizarlo acá en lugar del placeholder (misma <figure> y caption).
 */
export function FigureSlot({
  name,
  caption,
  variant = "article",
}: {
  name: string;
  caption?: string;
  variant?: Variant;
}) {
  if (!isFigureName(name)) return null;
  const figure = FIGURES[name];

  const canvas = (
    <div
      className={`fig-canvas fig-placeholder${variant === "mini" ? " fig-mini" : ""}`}
      role="img"
      aria-label={figure.label}
    >
      <span>{copy.figure.placeholder}</span>
      <code>{name}</code>
    </div>
  );

  if (variant === "mini") {
    return <div data-figure={name}>{canvas}</div>;
  }

  return (
    <figure
      className={`fig${figure.wide && variant === "article" ? " wide" : ""}`}
      data-figure={name}
    >
      {canvas}
      {caption && (
        <div className="fig-foot">
          <figcaption className="fig-small">{caption}</figcaption>
        </div>
      )}
    </figure>
  );
}

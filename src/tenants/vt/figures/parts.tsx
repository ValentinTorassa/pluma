import type { CSSProperties, ReactNode } from "react";
import { drawn, GLYPHS, paper, type GlyphName, type Pt, type ViewBox, xmark } from "./ink";

/** Props que FigureSlot le pasa a cada figura */
export type FigureProps = {
  name: string;
  /** Ocupa la columna ancha del artículo */
  wide: boolean;
  /** aria-label del dibujo (registry.ts) */
  label: string;
  /** Pie: el `caption` de la directiva o el de la maqueta */
  caption?: string;
};

/** translate en px para style.transform (en SVG, px = unidades del viewBox) */
export const tr = (x: number, y: number) => `translate(${x}px,${y}px)`;

export function FigureFrame({ name, wide, children }: { name: string; wide: boolean; children: ReactNode }) {
  return (
    <figure className={wide ? "fig wide" : "fig"} data-figure={name}>
      {children}
    </figure>
  );
}

/** Las cuatro × de las esquinas del marco punteado */
export function Marks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((k) => (
        <i key={k} className={`xm ${k}`} aria-hidden="true" />
      ))}
    </>
  );
}

export function Paper({ vb, step, ox, oy, major }: { vb: ViewBox; step: number; ox?: number; oy?: number; major?: number }) {
  const grid = paper(vb[0], vb[1], vb[2], vb[3], step, ox, oy, major);
  return (
    <g className="s-grid" aria-hidden="true">
      <path d={grid.minor} className="g1" />
      <path d={grid.major} className="g2" />
    </g>
  );
}

export function Drawn({ pts, seed, fold }: { pts: readonly Pt[]; seed: number; fold?: number }) {
  const shape = drawn(pts, seed, { fold });
  return (
    <g>
      <path d={shape.fill} className="s-fill" />
      <path d={shape.ink} className="s-ink" />
    </g>
  );
}

export function Node({ cx, cy, r = 5, className = "s-node" }: { cx: number; cy: number; r?: number; className?: string }) {
  return <circle cx={cx} cy={cy} r={r} className={className} />;
}

/** Recuadro de selección punteado con × en las esquinas */
export function SelBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const corners: Pt[] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="s-sel" />
      {corners.map(([px, py]) => (
        <path key={`${px}-${py}`} d={xmark(px, py)} className="s-x" />
      ))}
    </g>
  );
}

export function Glyph({ name, x, y, s = 16 }: { name: GlyphName; x: number; y: number; s?: number }) {
  return (
    <g className="s-glyph" transform={`translate(${x} ${y}) scale(${s / 16})`}>
      {GLYPHS[name].map((shape, i) =>
        "d" in shape ? (
          <path key={i} d={shape.d} />
        ) : (
          <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} className={shape.cls} />
        ),
      )}
    </g>
  );
}

/** Estilo de un elemento que se mueve por JS cuadro a cuadro (sin transición CSS) */
export const noTransition = (style: CSSProperties): CSSProperties => ({ ...style, transition: "none" });

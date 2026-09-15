"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame, rectPts, rng, sketch } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Glyph, Marks, Node, Paper } from "./parts";

const m = copy.figures.miniRotate;

/** dead: rotaste, la key no sirve en ninguna copia (reposo) · live: todavía es válida en las tres */
type Phase = "dead" | "live";

type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  kx: number;
  ky: number;
  cx: number;
  cw: number;
  ch: number;
  rows: number[];
};

const WIDE: Geo = { narrow: false, W: 680, H: 150, M: 16, kx: 40, ky: 66, cx: 330, cw: 210, ch: 30, rows: [18, 60, 102] };
const NARROW: Geo = { narrow: true, W: 360, H: 158, M: 10, kx: 26, ky: 70, cx: 150, cw: 180, ch: 28, rows: [22, 66, 110] };

function Scene({ G, phase, label }: { G: Geo; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const viva = phase === "live";
  const kx = G.kx;
  const ky = G.ky;

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el proveedor, donde vive la key de verdad */}
      <Glyph name="server" x={kx - 9} y={ky - 22} s={18} />
      <Node cx={kx} cy={ky + 8} r={4} />
      <text x={kx} y={ky + 30} textAnchor="middle" className="s-lab">
        {m.provider}
      </text>

      {G.rows.map((y, i) => {
        const cyRow = y + G.ch / 2;
        const midX = (kx + G.cx) / 2;
        return (
          <Fragment key={m.copies[i]}>
            {/* el cable del proveedor a la copia: vivo o cortado */}
            <path
              d={`M${kx + 12} ${ky + 8}C${midX} ${ky + 8} ${midX} ${cyRow} ${G.cx - 6} ${cyRow}`}
              className={viva ? "s-live" : "s-deadline"}
            />
            {/* la copia */}
            <path d={sketch(rng(810 + i), rectPts(G.cx, y, G.cw, G.ch), true, 1.3, 0.7)} className="s-ink-thin" />
            <text x={G.cx + 10} y={y + G.ch / 2 + 4} className="s-lab">
              {G.narrow ? m.copiesNarrow[i] : m.copies[i]}
            </text>
            {/* la marca de que esa copia ya no sirve */}
            <path
              d={`M${G.cx + G.cw - 34} ${y + 8}l22 ${G.ch - 16}M${G.cx + G.cw - 12} ${y + 8}l-22 ${G.ch - 16}`}
              className="s-strike"
              style={{ opacity: viva ? 0 : 1 }}
            />
            <circle
              cx={G.cx + G.cw - 23}
              cy={cyRow}
              r={4}
              className="s-pulse"
              style={{ opacity: viva ? 1 : 0 }}
            />
          </Fragment>
        );
      })}

      <text x={0} y={G.H - 2} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: la key del proveedor y las tres copias que la tienen.
 * Queda dibujada con la key ya rotada —las tres muertas—, que es la respuesta
 * del artículo y lo que se ve sin JS; al cargar y al pasar el mouse muestra el
 * momento anterior, con la key viva en las tres.
 */
export function MiniRotate({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("dead");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const play = () => {
      if (prefersReducedMotion()) return;
      clear();
      setPhase("live");
      timers.push(setTimeout(() => setPhase("dead"), 900));
    };
    timers.push(setTimeout(play, 350));
    const link = root.current?.closest("a");
    link?.addEventListener("mouseenter", play);
    return () => {
      clear();
      link?.removeEventListener("mouseenter", play);
    };
  }, []);

  return (
    <div ref={root} className="fig-canvas fig-mini" data-figure="rotate-vs-clean">
      <Scene G={WIDE} phase={phase} label={label} />
      <Scene G={NARROW} phase={phase} label={label} />
      <Marks />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { frame, rectPts, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, Glyph, Marks, Paper, tr } from "./parts";

const m = copy.figures.miniEgress;

/** v04: la frena el control del valor (la respuesta del artículo) · v03: pasa la allowlist y llega */
type Phase = "v03" | "v04";
type Gate = "value" | "tool" | "dest" | "path";
const GATES: Gate[] = ["value", "tool", "dest", "path"];

type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  y: number;
  wire: [number, number];
  gx: Record<Gate, number>;
  labels: Gate[];
  bracket: string | null;
  bracketLabel: Pt | null;
  agent: Pt;
  site: { x: number; y: number; w: number; h: number };
  chip: string;
  /** Centro de la ficha que llegó al sitio (la frenada queda justo antes del control del valor) */
  landed: number;
};

const WIDE: Geo = {
  narrow: false,
  W: 680,
  H: 150,
  M: 16,
  y: 62,
  wire: [34, 540],
  gx: { value: 176, tool: 284, dest: 372, path: 460 },
  labels: GATES,
  bracket: null,
  bracketLabel: null,
  agent: [0, 50],
  site: { x: 540, y: 22, w: 140, h: 80 },
  chip: m.chip,
  landed: 610,
};

const NARROW: Geo = {
  narrow: true,
  W: 360,
  H: 168,
  M: 10,
  y: 74,
  wire: [30, 256],
  gx: { value: 146, tool: 184, dest: 214, path: 244 },
  labels: ["value"],
  bracket: "M172 50v-6H256v6",
  bracketLabel: [214, 36],
  agent: [0, 62],
  site: { x: 256, y: 34, w: 104, h: 76 },
  chip: m.chipNarrow,
  landed: 308,
};

const shown = (on: boolean, delay = 0): CSSProperties => ({ opacity: on ? 1 : 0, transitionDelay: on ? `${delay}ms` : "0ms" });

function Scene({ G, phase, label }: { G: Geo; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const v04 = phase === "v04";
  const S = G.site;
  const w = G.chip.length * 7.2 + 16;
  const cx = v04 ? G.gx.value - w / 2 - 12 : G.landed;

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      <path d={`M${G.wire[0]} ${G.y}L${G.wire[1]} ${G.y}`} className="s-link" />
      <Glyph name="bot" x={G.agent[0]} y={G.agent[1]} s={24} />

      {G.bracket && G.bracketLabel && (
        <>
          <path d={G.bracket} className="s-bracket" />
          <text x={G.bracketLabel[0]} y={G.bracketLabel[1]} textAnchor="middle" className="s-lab">
            {m.allowlist}
          </text>
        </>
      )}

      {GATES.map((g, i) => {
        const x = G.gx[g];
        const isValue = g === "value";
        return (
          <g key={g} style={isValue ? shown(v04) : undefined}>
            <Drawn pts={rectPts(x - 6, G.y - 18, 12, 36)} seed={1401 + i} />
            {G.labels.includes(g) && (
              <text x={x} y={G.y - 30} textAnchor="middle" className="s-lab">
                {m.gates[g]}
              </text>
            )}
            {!isValue && <Glyph name="check" x={x - 6} y={G.y + 26} s={12} />}
          </g>
        );
      })}
      <path d={xmark(G.gx.value, G.y, 6)} className="s-x" style={shown(v04)} />

      <Drawn pts={rectPts(S.x, S.y, S.w, S.h)} seed={1405} />
      <text x={S.x + 10} y={S.y + 20} className="s-lab">
        {m.site}
      </text>

      {/* la ficha con la key: frenada en el valor, o adentro del sitio */}
      <g style={{ transform: tr(cx - w / 2, G.y - 10) }}>
        <rect width={w} height={20} rx={4} className="s-fill" />
        <rect width={w} height={20} rx={4} className="s-tag-key" />
        <text x={8} y={14} className="t-key">
          {G.chip}
        </text>
      </g>

      <text x={0} y={G.H - 4} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: la key que pasa la allowlist. Queda en la respuesta
 * del artículo (0.4.0 la frena por su valor) y es lo que se ve sin JS; al
 * cargar y al pasar el mouse por el link muestra cómo pasaba antes y vuelve.
 */
export function MiniEgress({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("v04");
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
      setPhase("v03");
      timers.push(setTimeout(() => setPhase("v04"), 2000));
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
    <div ref={root} className="fig-canvas fig-mini" data-figure="allowlist-egress">
      <Scene G={WIDE} phase={phase} label={label} />
      <Scene G={NARROW} phase={phase} label={label} />
      <Marks />
    </div>
  );
}

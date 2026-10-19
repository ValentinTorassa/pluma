"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, Marks, Paper } from "./parts";
import { AMOUNT, pesos } from "./WebhookRetry";

const m = copy.figures.miniRetry;

/** once: el id anotado descarta el reintento (la respuesta del artículo) · twice: se acredita dos veces */
type Phase = "once" | "twice";

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  chips: [Box, Box];
  sheet: Box;
  lines: [Cubic, Cubic];
  dupLabel: Pt;
};

const WIDE: Geo = {
  narrow: false,
  W: 680,
  H: 150,
  M: 16,
  chips: [
    { x: 0, y: 6, w: 150, h: 42 },
    { x: 0, y: 66, w: 150, h: 42 },
  ],
  sheet: { x: 460, y: 6, w: 220, h: 102 },
  lines: [cubic([150, 27], [300, 27], [330, 46], [460, 46]), cubic([150, 87], [300, 87], [330, 68], [460, 68])],
  dupLabel: [352, 104],
};

const NARROW: Geo = {
  narrow: true,
  W: 360,
  H: 168,
  M: 10,
  chips: [
    { x: 0, y: 6, w: 112, h: 42 },
    { x: 0, y: 66, w: 112, h: 42 },
  ],
  sheet: { x: 200, y: 6, w: 160, h: 102 },
  lines: [cubic([112, 27], [150, 27], [160, 46], [200, 46]), cubic([112, 87], [150, 87], [160, 68], [200, 68])],
  dupLabel: [120, 126],
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, phase, label }: { G: Geo; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const twice = phase === "twice";
  const S = G.sheet;
  const [l1, l2] = G.lines;
  const stop = l2.at(l2.length * 0.72);
  const subs = [m.firstSub, m.secondSub];

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      <path d={l1.d} className="s-link" />
      {/* el reintento: se corta en el id anotado, o llega y acredita otra vez */}
      <path d={l2.d} className="s-deadline" />
      <path
        d={l2.d}
        className={twice ? "s-live" : "s-link"}
        style={{ strokeDasharray: `${l2.dash} ${l2.dash}`, strokeDashoffset: twice ? 0 : l2.dash - l2.length * 0.72 }}
      />
      <path d={xmark(stop[0], stop[1], 5)} className="s-x" style={shown(!twice)} />
      <text x={G.dupLabel[0]} y={G.dupLabel[1]} textAnchor={G.narrow ? "start" : "middle"} className="s-lab" style={shown(!twice)}>
        {m.dup}
      </text>

      {G.chips.map((c, i) => (
        <g key={i}>
          <Drawn pts={rectPts(c.x, c.y, c.w, c.h)} seed={911 + i} />
          <text x={c.x + 12} y={c.y + 18} className="s-hash">
            {i === 0 ? m.first : m.second}
          </text>
          <text x={c.x + 12} y={c.y + 34} className="s-lab">
            {subs[i]}
          </text>
        </g>
      ))}

      <Drawn pts={sheetPts(S.x, S.y, S.w, S.h, 10)} seed={913} fold={10} />
      <text x={S.x + 14} y={S.y + 24} className="s-hash">
        {m.order}
      </text>
      <text x={S.x + 14} y={S.y + 62} className={twice ? "wh-amount bad" : "wh-amount"}>
        {pesos(twice ? AMOUNT * 2 : AMOUNT)}
      </text>
      <text x={S.x + 14} y={S.y + 86} className="s-lab">
        {twice ? m.twice : m.once}
      </text>

      <text x={0} y={G.H - 4} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: el mismo evento entregado dos veces. Queda en la
 * respuesta del artículo (se acredita una vez) y es lo que se ve sin JS; al
 * cargar y al pasar el mouse por el link muestra el doble crédito y vuelve.
 */
export function MiniRetry({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("once");
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
      setPhase("twice");
      timers.push(setTimeout(() => setPhase("once"), 1800));
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
    <div ref={root} className="fig-canvas fig-mini" data-figure="webhook-retry">
      <Scene G={WIDE} phase={phase} label={label} />
      <Scene G={NARROW} phase={phase} label={label} />
      <Marks />
    </div>
  );
}

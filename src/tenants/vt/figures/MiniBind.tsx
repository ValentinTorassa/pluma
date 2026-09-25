"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, xmark, type Cubic, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, Glyph, Marks, Node, Paper } from "./parts";

const m = copy.figures.miniBind;

/** local: 127.0.0.1, el estado en reposo y la respuesta del artículo · open: 0.0.0.0 */
type Phase = "local" | "open";
const ADDR: Record<Phase, string> = { local: "127.0.0.1:3000", open: "0.0.0.0:3000" };

type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  machine: { x: number; y: number; w: number; h: number };
  port: Pt;
  addr: Pt;
  laptop: Pt;
  lanLabel: Pt;
  chip: { x: number; y: number; w: number; h: number };
  lan: Cubic;
};

const WIDE: Geo = {
  narrow: false,
  W: 680,
  H: 150,
  M: 16,
  machine: { x: 0, y: 8, w: 250, h: 104 },
  port: [250, 64],
  addr: [262, 52],
  laptop: [440, 40],
  lanLabel: [474, 58],
  chip: { x: 474, y: 70, w: 90, h: 22 },
  lan: cubic([250, 64], [330, 64], [360, 52], [434, 52]),
};

const NARROW: Geo = {
  narrow: true,
  W: 360,
  H: 164,
  M: 10,
  machine: { x: 0, y: 8, w: 190, h: 104 },
  port: [190, 64],
  addr: [196, 132],
  laptop: [288, 40],
  lanLabel: [300, 86],
  chip: { x: 262, y: 94, w: 80, h: 22 },
  lan: cubic([190, 64], [230, 64], [250, 52], [282, 52]),
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, phase, label }: { G: Geo; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const Mb = G.machine;
  const open = phase === "open";
  const refused = G.lan.at(16);

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      <path d={G.lan.d} className="s-deadline" />
      <path
        d={G.lan.d}
        className="s-live"
        style={{ strokeDasharray: `${G.lan.dash} ${G.lan.dash}`, strokeDashoffset: open ? 0 : G.lan.dash }}
      />
      <path d={xmark(refused[0], refused[1], 4.5)} className="s-x" style={shown(!open)} />
      <Drawn pts={rectPts(Mb.x, Mb.y, Mb.w, Mb.h)} seed={801} />
      <text x={Mb.x + 12} y={Mb.y + 22} className="s-title">
        {m.machine}
      </text>
      <g className="is-key">
        <rect x={Mb.x + 10} y={Mb.y + 40} width={92} height={19} rx={3} className="s-keybg" />
        <text x={Mb.x + 18} y={Mb.y + 54} className="s-file">
          {m.file}
        </text>
      </g>
      <Node cx={G.port[0]} cy={G.port[1]} r={5} />
      <text x={G.addr[0]} y={G.addr[1]} className="s-hash">
        {ADDR[phase]}
      </text>
      <Glyph name="laptop" x={G.laptop[0]} y={G.laptop[1]} s={24} />
      <text x={G.lanLabel[0]} y={G.lanLabel[1]} textAnchor={G.narrow ? "middle" : "start"} className="s-lab">
        {m.lan}
      </text>
      <g className="is-key" style={shown(open)}>
        <rect x={G.chip.x} y={G.chip.y} width={G.chip.w} height={G.chip.h} rx={3} className="s-keybg" />
        <text x={G.chip.x + 10} y={G.chip.y + 15} className="s-file">
          {m.file}
        </text>
      </g>
      <text x={0} y={G.H - 4} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: un puerto y otra máquina de la red. Queda en
 * 127.0.0.1, que es la respuesta del artículo y lo que se ve sin JS; al
 * cargar y al pasar el mouse por el link muestra 0.0.0.0 y vuelve.
 */
export function MiniBind({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("local");
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
      setPhase("open");
      timers.push(setTimeout(() => setPhase("local"), 1600));
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
    <div ref={root} className="fig-canvas fig-mini" data-figure="bind-scope">
      <Scene G={WIDE} phase={phase} label={label} />
      <Scene G={NARROW} phase={phase} label={label} />
      <Marks />
    </div>
  );
}

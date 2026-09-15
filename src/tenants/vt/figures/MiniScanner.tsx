"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Glyph, Marks, Node, Paper } from "./parts";

const m = copy.figures.miniScanner;

/** late: lo que se ve en reposo, te diste cuenta tarde · early: el instante del push, todavía no pasó nada */
type Phase = "late" | "early";

/** minutos desde el push */
const READ = 4;
const USES = [7, 11, 16, 20];
const YOU = 24;
const TOTAL = 30;

type Geo = { narrow: boolean; W: number; H: number; M: number; x0: number; x1: number; y: number };
const WIDE: Geo = { narrow: false, W: 680, H: 140, M: 16, x0: 46, x1: 640, y: 76 };
const NARROW: Geo = { narrow: true, W: 360, H: 150, M: 10, x0: 30, x1: 340, y: 80 };

function Scene({ G, phase, label }: { G: Geo; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const at = (min: number) => G.x0 + (min / TOTAL) * (G.x1 - G.x0);
  const tarde = phase === "late";
  const winA = at(READ);
  const winB = at(YOU);
  const largo = winB - winA;

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* la regla y sus marcas */}
      <path d={`M${G.x0} ${G.y}H${G.x1}`} className="s-ruler" />
      {[0, 10, 20, 30].map((min) => (
        <g key={min}>
          <path d={`M${at(min)} ${G.y}v6`} className="s-ticks" />
          <text x={at(min)} y={G.y + 20} textAnchor="middle" className="s-tick">
            {min === 0 ? "0" : String(min)}
          </text>
        </g>
      ))}
      <text x={G.x1} y={G.y + 36} textAnchor="end" className="s-tick">
        {m.unit}
      </text>

      {/* la ventana de exposición: se dibuja de izquierda a derecha */}
      <path
        d={`M${winA} ${G.y}H${winB}`}
        className="s-win"
        style={{ strokeDasharray: largo, strokeDashoffset: tarde ? 0 : largo }}
      />

      {/* el push */}
      <Node cx={G.x0} cy={G.y} r={4} />
      <text x={G.x0} y={G.y - 14} textAnchor="middle" className="s-lab">
        {m.push}
      </text>

      {/* el scanner que lee */}
      <g style={{ opacity: tarde ? 1 : 0 }}>
        <Glyph name="eye" x={at(READ) - 7} y={G.y - 36} s={14} />
        <text x={at(READ) + 12} y={G.y - 25} className="s-lab">
          {G.narrow ? m.readNarrow : m.read}
        </text>
      </g>

      {/* cada punto es un uso de la key */}
      {USES.map((min, i) => (
        <circle
          key={min}
          cx={at(min)}
          cy={G.y}
          r={3.5}
          className="s-use"
          style={{ opacity: tarde ? 1 : 0, transform: tarde ? "translate(0px,0px)" : `translate(-${6 + i * 2}px,0px)` }}
        />
      ))}

      {/* dónde te diste cuenta */}
      <g style={{ transform: `translate(${tarde ? winB : winA}px,0px)` }}>
        <path d={`M0 ${G.y - 16}v32`} className="s-you" />
        <text x={0} y={G.y + 36} textAnchor="middle" className="s-youtxt">
          {m.you}
        </text>
      </g>

      <text x={0} y={G.H - 2} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: la ventana entre el push y el momento en que te diste
 * cuenta. Queda dibujada en el estado tarde, que es el del artículo y lo que se
 * ve sin JS; al cargar y al pasar el mouse vuelve al push y corre de nuevo.
 */
export function MiniScanner({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("late");
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
      setPhase("early");
      timers.push(setTimeout(() => setPhase("late"), 420));
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
    <div ref={root} className="fig-canvas fig-mini" data-figure="scanner-race">
      <Scene G={WIDE} phase={phase} label={label} />
      <Scene G={NARROW} phase={phase} label={label} />
      <Marks />
    </div>
  );
}

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame, poly, rectPts, rng, sketch } from "./ink";
import { prefersReducedMotion, useSvgId } from "./motion";
import { Marks, Paper } from "./parts";

const m = copy.figures.miniChmod;

/** safe: 640, el estado en reposo y la respuesta del artículo · open: 777, los nueve abiertos */
type Phase = "safe" | "open";

const RWX = ["r", "w", "x"] as const;
const BITS: Record<Phase, number[]> = {
  safe: [1, 1, 0, 1, 0, 0, 0, 0, 0],
  open: [1, 1, 1, 1, 1, 1, 1, 1, 1],
};
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7];
const ROLL = 44;

type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  cx: number[];
  cs: number;
  rows: number[];
  ox: number;
};

const WIDE: Geo = { narrow: false, W: 680, H: 150, M: 16, cx: [300, 348, 396], cs: 34, rows: [26, 68, 110], ox: 470 };
const NARROW: Geo = { narrow: true, W: 360, H: 164, M: 10, cx: [178, 218, 258], cs: 30, rows: [30, 74, 118], ox: 314 };

const octal = (bits: number[]) => [0, 1, 2].map((i) => bits[i * 3] * 4 + bits[i * 3 + 1] * 2 + bits[i * 3 + 2]);

function Scene({ G, phase, uid, label }: { G: Geo; phase: Phase; uid: string; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const mode = G.narrow ? "n" : "w";
  const bits = BITS[phase];
  const o = octal(bits);
  const clipId = (i: number) => `mc-${mode}-${i}-${uid}`;

  return (
    <svg
      className={`ink ${G.narrow ? "mini-n" : "mini-w"}`}
      viewBox={viewBox}
      role="img"
      aria-label={label}
    >
      <Paper vb={vb} step={20} />
      <defs>
        {G.rows.map((y, i) => (
          <clipPath key={y} id={clipId(i)}>
            <rect x={G.ox - 20} y={y - 21} width={40} height={40} />
          </clipPath>
        ))}
      </defs>
      {G.rows.map((y, i) => (
        <Fragment key={y}>
          <text x={0} y={y + 5} className="s-lab">
            {m.who[i]}
          </text>
          {RWX.map((ch, j) => {
            const k = i * 3 + j;
            const on = bits[k] === 1;
            const s = G.cs;
            const x = G.cx[j] - s / 2;
            const yy = y - s / 2;
            return (
              <g key={ch} className={`cell${on ? " on" : ""}${on && k >= 6 ? " danger" : ""}`}>
                <path d={poly(rectPts(x, yy, s, s))} className="s-cellfill" />
                <path d={sketch(rng(700 + k), rectPts(x, yy, s, s), true, 1.3, 0.7)} className="s-cellink" />
                <text x={G.cx[j]} y={y + 5} textAnchor="middle">
                  {ch}
                </text>
              </g>
            );
          })}
          <path d={sketch(rng(720 + i), rectPts(G.ox - 21, y - 22, 42, 42), true, 1.2, 0.6)} className="s-ink-thin" />
          <g clipPath={`url(#${clipId(i)})`}>
            <g style={{ transform: `translate(0px,${-o[i] * ROLL}px)` }}>
              {DIGITS.map((d) => (
                <text key={d} x={G.ox} y={y + 12 + d * ROLL} textAnchor="middle" className="s-oct">
                  {String(d)}
                </text>
              ))}
            </g>
          </g>
        </Fragment>
      ))}
      <text x={0} y={G.H - 4} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: los nueve casilleros de un archivo. Queda dibujada en
 * 640, que es la respuesta del artículo y lo que se ve sin JS; al cargar y al
 * pasar el mouse por el link muestra el 777 y vuelve.
 */
export function MiniChmod({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("safe");
  const uid = useSvgId();
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
      timers.push(setTimeout(() => setPhase("safe"), 900));
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
    <div ref={root} className="fig-canvas fig-mini" data-figure="chmod">
      <Scene G={WIDE} phase={phase} uid={uid} label={label} />
      <Scene G={NARROW} phase={phase} uid={uid} label={label} />
      <Marks />
    </div>
  );
}

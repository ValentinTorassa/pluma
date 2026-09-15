"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame, fx, rl, rng } from "./ink";
import { prefersReducedMotion, useSvgId } from "./motion";
import { FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";

const m = copy.figures.scannerRace;

/** Minuto en que cada scanner lee la key, y minuto de cada uso */
const DET = [1, 2, 6];
const USES = [4, 9, 15, 22];
const SPAN = 30;
const START = 12;
const REPLAY_MS = 4600;

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  x0: number;
  x1: number;
  /** y de la línea de tiempo: todo cuelga de acá */
  yL: number;
  tick: number;
  cell: number;
};

const X = (G: Pick<Geo, "x0" | "x1">, t: number) => G.x0 + ((G.x1 - G.x0) * t) / SPAN;

const WIDE: Geo = { narrow: false, M: 20, W: 720, H: 150, x0: 56, x1: 690, yL: 78, tick: 5, cell: 1 };
const NARROW: Geo = { narrow: true, M: 12, W: 380, H: 164, x0: 34, x1: 352, yL: 86, tick: 10, cell: 2 };

/** Reproducción: minuto simulado; `still` = primer cuadro, sin transiciones */
type Play = { sim: number; still: boolean } | null;

function Scene({ G, r, play, label }: { G: Geo; r: number; play: Play; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const sim = play ? play.sim : SPAN;
  const xr = X(G, r);
  const right = xr > G.W - 120;

  let ticks = "";
  for (let t = 0; t <= SPAN; t++) ticks += `M${fx(X(G, t))} ${G.yL}v${t % 5 === 0 ? 7 : 4}`;
  const tickLabels: number[] = [];
  for (let t = 0; t <= SPAN; t += G.tick) tickLabels.push(t);

  // En angosto los tres ojos se pisarían (1 y 2 min quedan a menos de 10px),
  // así que se muestra uno solo en la última lectura, rotulado como los tres.
  const eyes = G.narrow ? [DET[DET.length - 1]] : DET;
  const yEye = G.yL - 30;
  const yUse = G.yL + 32;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}${play?.still ? " still" : ""}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={((G.x1 - G.x0) / SPAN) * G.cell} ox={G.x0} oy={G.yL} major={5} />

      {/* la ventana de exposición vive sobre la línea, no en una banda aparte */}
      <path
        d={`M${G.x0} ${G.yL}H${G.x1}`}
        className="s-win quick"
        style={{ transformBox: "fill-box", transformOrigin: "left center", transform: `scaleX(${Math.max(r, 0.001) / SPAN})` }}
      />
      <path d={rl(rng(G.narrow ? 71 : 17), G.x0, G.yL, G.x1, G.yL, 1.1, 0.5)} className="s-ruler" />
      <path d={ticks} className="s-ticks" />
      {tickLabels.map((t) => (
        <text key={t} x={X(G, t)} y={G.yL + 22} textAnchor={t === 0 ? "start" : t === SPAN ? "end" : "middle"} className="s-tick">
          {t === SPAN ? m.lastTick : String(t)}
        </text>
      ))}

      {eyes.map((d) => (
        <g key={d} className={`mk${sim >= d ? " on" : ""}`}>
          <Glyph name="eye" x={X(G, d) - 8} y={yEye - 8} />
        </g>
      ))}
      <text x={X(G, eyes[eyes.length - 1]) + 14} y={yEye + 4} className="s-lab">
        {G.narrow ? m.readNarrow : m.read}
      </text>

      {USES.map((u) => (
        <g key={u} className={`mk${sim >= u ? " on" : ""}${u > r ? " dead" : ""}`}>
          <circle cx={X(G, u)} cy={yUse} r={4.5} className="s-use" />
        </g>
      ))}
      <text x={G.x0} y={yUse + 26} className="s-lab">
        {m.uses}
      </text>

      <line x1={X(G, 0)} x2={X(G, 0)} y1={G.yL - 46} y2={G.yL - 8} className="s-stem" />
      <Node cx={X(G, 0)} cy={G.yL} r={5.5} />
      <text x={X(G, 0)} y={G.yL - 52} textAnchor="start" className="s-lab">
        {m.push}
      </text>

      <g className="quick" style={{ transform: `translate(${xr}px,0px)` }}>
        <line x1={0} x2={0} y1={G.yL - 46} y2={G.yL + 12} className="s-you" />
        <Node cx={0} cy={G.yL - 46} r={6} />
        <text x={right ? -11 : 11} y={G.yL - 50} textAnchor={right ? "end" : "start"} className="s-youtxt">
          {m.you}
        </text>
      </g>

      <line
        x1={X(G, sim)}
        x2={X(G, sim)}
        y1={G.yL - 40}
        y2={G.yL + 40}
        className="s-play"
        style={{ opacity: play ? 1 : 0, transition: "none" }}
      />
    </svg>
  );
}

/** Figura B: la ventana de exposición sobre una sola línea de tiempo */
export function ScannerRace({ name, wide, label, caption }: FigureProps) {
  const uid = useSvgId();
  const inputId = `race-t-${uid}`;
  const [r, setR] = useState(START);
  const [play, setPlay] = useState<Play>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function replay() {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) {
      setPlay(null);
      return;
    }
    setPlay({ sim: 0, still: true });
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / REPLAY_MS));
      if (p < 1) {
        setPlay({ sim: SPAN * Math.pow(p, 1.7), still: false });
        raf.current = requestAnimationFrame(tick);
      } else {
        setPlay(null);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }

  const read = DET.filter((d) => d <= r).length;
  const used = USES.filter((u) => u <= r).length;

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} r={r} play={play} label={label} />
        <Scene G={NARROW} r={r} play={play} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="scrub">
          <label htmlFor={inputId}>{m.when}</label>
          <input
            type="range"
            id={inputId}
            min={0}
            max={SPAN}
            step={1}
            value={r}
            aria-valuetext={`${r} ${m.unit}`}
            onChange={(e) => setR(Number(e.target.value))}
          />
          <output htmlFor={inputId}>{`${r} ${m.unit}`}</output>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(m.result(read, used, r - USES[0]))}
        </p>
        <figcaption className="fig-small">
          {caption && `${caption} `}
          <button type="button" className="plain replay" onClick={replay}>
            {m.replay}
          </button>
        </figcaption>
      </div>
    </FigureFrame>
  );
}

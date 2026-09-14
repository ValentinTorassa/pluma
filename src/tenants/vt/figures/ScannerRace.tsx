"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { cubic, frame, fx, type Cubic } from "./ink";
import { prefersReducedMotion, useSvgId } from "./motion";
import { FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";

const m = copy.figures.scannerRace;

/** Minuto en que cada scanner lee la key, y usos (scanner, minuto) */
const DET = [1, 2, 6];
const USES = [
  { b: 0, t: 4 },
  { b: 2, t: 9 },
  { b: 0, t: 15 },
  { b: 1, t: 22 },
];
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
  yV: number;
  yB: number[];
  yU: number;
  yR: number;
  tick: number;
  cell: number;
  labs: readonly string[];
  sigs: Cubic[];
};

const X = (G: Pick<Geo, "x0" | "x1">, t: number) => G.x0 + ((G.x1 - G.x0) * t) / SPAN;

function geo(g: Omit<Geo, "sigs">): Geo {
  const sigs = DET.map((d, i) =>
    cubic([X(g, 0), g.yV], [X(g, 0), g.yB[i]], [X(g, d) - 14, g.yB[i]], [X(g, d), g.yB[i]]),
  );
  return { ...g, sigs };
}

const WIDE = geo({ narrow: false, M: 20, W: 720, H: 268, x0: 142, x1: 700, yV: 58, yB: [108, 140, 172], yU: 210, yR: 236, tick: 5, cell: 1, labs: m.lanesWide });
const NARROW = geo({ narrow: true, M: 12, W: 380, H: 268, x0: 74, x1: 366, yV: 58, yB: [108, 140, 172], yU: 210, yR: 236, tick: 10, cell: 2, labs: m.lanesNarrow });

/** Reproducción: minuto simulado; `still` = primer cuadro, sin transiciones */
type Play = { sim: number; still: boolean } | null;

function Scene({ G, r, play, uid, label }: { G: Geo; r: number; play: Play; uid: string; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const mode = G.narrow ? "n" : "w";
  const hatch = `race-hatch-${mode}-${uid}`;
  const clip = `race-clip-${mode}-${uid}`;
  const sim = play ? play.sim : SPAN;
  const xr = X(G, r);
  const right = xr > G.W - 110;
  let ticks = "";
  for (let t = 0; t <= SPAN; t++) ticks += `M${fx(X(G, t))} ${G.yR}v${t % 5 === 0 ? 8 : 4}`;
  const tickLabels: number[] = [];
  for (let t = 0; t <= SPAN; t += G.tick) tickLabels.push(t);
  const playX = play ? X(G, sim) : 0;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}${play?.still ? " still" : ""}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={((G.x1 - G.x0) / SPAN) * G.cell} ox={G.x0} oy={G.yR} major={5} />
      {[G.yV, ...G.yB, G.yU].map((y, i) => (
        <Fragment key={i}>
          <path d={`M${G.x0} ${y}H${G.x1}`} className="s-lane" />
          <text x={0} y={y + 4} className="s-lab">
            {G.labs[i]}
          </text>
        </Fragment>
      ))}
      {G.yB.map((y) => (
        <Glyph key={y} name="eye" x={G.x0 - 26} y={y - 8} />
      ))}
      <path d={`M${G.x0} ${G.yR}H${G.x1}`} className="s-ruler" />
      <path d={ticks} className="s-ticks" />
      {tickLabels.map((t) => (
        <text key={t} x={X(G, t)} y={G.yR + 24} textAnchor={t === 0 ? "start" : t === SPAN ? "end" : "middle"} className="s-tick">
          {t === SPAN ? m.lastTick : String(t)}
        </text>
      ))}
      <defs>
        <pattern id={hatch} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 -1V7" className="s-hatch" />
        </pattern>
        <clipPath id={clip}>
          <rect
            x={G.x0}
            y={G.yU - 11}
            width={G.x1 - G.x0}
            height={22}
            className="quick"
            style={{ transformBox: "fill-box", transformOrigin: "left center", transform: `scaleX(${r / SPAN})` }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={G.x0} y={G.yU - 11} width={G.x1 - G.x0} height={22} fill={`url(#${hatch})`} />
        <path d={`M${G.x0} ${G.yU - 11}H${G.x1}M${G.x0} ${G.yU + 11}H${G.x1}`} className="s-bandedge" />
      </g>
      {G.sigs.map((s) => (
        <path key={s.d} d={s.d} className="s-sig" />
      ))}
      {DET.map((d, i) => {
        const q = Math.min(1, sim / d);
        const [cx, cy] = play ? G.sigs[i].at(q * G.sigs[i].length) : [0, 0];
        return <circle key={d} r={3} cx={cx} cy={cy} className="s-trav" style={{ opacity: play && q < 1 ? 1 : 0, transition: "none" }} />;
      })}
      <Node cx={X(G, 0)} cy={G.yV} r={5.5} />
      <text x={X(G, 0) - 12} y={G.yV - 10} textAnchor="end" className="s-lab">
        {m.push}
      </text>
      {DET.map((d, i) => (
        <Node key={d} cx={X(G, d)} cy={G.yB[i]} r={4.5} className={`mk${sim >= d ? " on" : ""} s-node`} />
      ))}
      {USES.map((u) => {
        const x = X(G, u.t);
        return (
          <g key={u.t} className={`mk${sim >= u.t ? " on" : ""}${u.t > r ? " dead" : ""}`}>
            <line x1={x} x2={x} y1={G.yB[u.b] + 5} y2={G.yU - 5} className="s-uselink" />
            <rect x={x - 3.5} y={G.yB[u.b] - 3.5} width={7} height={7} className="s-use" />
            <circle cx={x} cy={G.yU} r={4.5} className="s-use" />
          </g>
        );
      })}
      <g className="quick" style={{ transform: `translate(${xr}px,0px)` }}>
        <line x1={0} x2={0} y1={G.yV - 22} y2={G.yR} className="s-you" />
        <Node cx={0} cy={G.yV - 22} r={6} />
        <text x={right ? -11 : 11} y={G.yV - 26} textAnchor={right ? "end" : "start"} className="s-youtxt">
          {m.you}
        </text>
      </g>
      <line x1={playX} x2={playX} y1={G.yV - 8} y2={G.yR} className="s-play" style={{ opacity: play ? 1 : 0, transition: "none" }} />
    </svg>
  );
}

/** Figura B: la carrera contra los scanners; el scrubber marca cuándo te diste cuenta */
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
  const used = USES.filter((u) => u.t <= r).length;

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} r={r} play={play} uid={uid} label={label} />
        <Scene G={NARROW} r={r} play={play} uid={uid} label={label} />
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
          {rich(m.result(read, used, r - USES[0].t))}
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

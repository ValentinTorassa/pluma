"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { frame, sheetPts, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Node, Paper, SelBox, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";

const m = copy.figures.gitHistory;

/** Qué archivos hay en la foto de cada commit (orden de m.files) */
const IN = [
  [1, 1, 0, 0],
  [1, 1, 0, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 0],
];
const CLONE_STEP = 4;
const LAST_COMMIT = 3;

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  cw: number;
  ch: number;
  head: number;
  row: number;
  fold: number;
  nd: Pt;
  pos: (i: number, lane: 0 | 1) => { x: number; y: number };
  labels: readonly (readonly [string, number, number])[];
  empty: Pt;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 440,
  cw: 156,
  ch: 144,
  head: 52,
  row: 22,
  fold: 14,
  nd: [78, -20],
  pos: (i, lane) => ({ x: 12 + i * 180, y: lane ? 294 : 58 }),
  labels: [
    [m.repo, 12, 14],
    [m.otherWide, 12, 250],
  ],
  empty: [360, 370],
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 614,
  cw: 158,
  ch: 130,
  head: 48,
  row: 20,
  fold: 13,
  nd: [-15, 20],
  pos: (i, lane) => ({ x: lane ? 210 : 24, y: 44 + i * 146 }),
  labels: [
    [m.repo, 24, 22],
    [m.otherNarrow, 210, 22],
  ],
  empty: [289, 263],
};

function Card({
  G,
  i,
  seed,
  files,
  snap,
  style,
}: {
  G: Geo;
  i: number;
  seed: number;
  files: number[];
  snap?: boolean;
  style: CSSProperties;
}) {
  const commit = m.commits[i];
  return (
    <g style={style}>
      <Drawn pts={sheetPts(0, 0, G.cw, G.ch, G.fold)} seed={seed} fold={G.fold} />
      <text x={12} y={22} className="s-hash">
        {commit.hash}
      </text>
      <text x={12} y={38} className="s-msg">
        {commit.msg}
      </text>
      <path d={`M12 ${G.head - 5}H${G.cw - 12}`} className="s-guide" />
      {m.files.map((file, j) => {
        const y = G.head + j * G.row;
        const on = files[j] === 1;
        const isKey = file === m.envFile;
        const cls = [isKey ? "is-key" : "", snap ? "snap" : ""].filter(Boolean).join(" ");
        return (
          <g
            key={file}
            className={cls || undefined}
            style={{ opacity: on ? 1 : 0, transform: on ? "translate(0px,0px)" : "translate(10px,0px)" }}
          >
            {isKey && <rect x={7} y={y + 1} width={G.cw - 14} height={G.row - 3} rx={3} className="s-keybg" />}
            <text x={14} y={y + G.row / 2 + 4} className="s-file">
              {file}
            </text>
          </g>
        );
      })}
      <Node cx={G.nd[0]} cy={G.nd[1]} r={5} />
    </g>
  );
}

function Scene({ G, step, pending, label }: { G: Geo; step: number; pending: number[]; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const P = (i: number, lane: 0 | 1): Pt => {
    const p = G.pos(i, lane);
    return [p.x + G.nd[0], p.y + G.nd[1]];
  };
  const k = Math.min(step, LAST_COMMIT);
  const cloned = step === CLONE_STEP;
  const [c0, c3, a, b] = [P(0, 1), P(3, 1), P(0, 0), P(3, 0)];
  const L = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]));
  const hp = G.pos(k, 0);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      {G.labels.map(([text, x, y]) => (
        <text key={text} x={x} y={y} className="s-lab">
          {text}
        </text>
      ))}
      <path d={`M${c0[0]} ${c0[1]}L${c3[0]} ${c3[1]}`} className="s-guide" />
      <path
        d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`}
        className="s-chain"
        style={{ strokeDasharray: L, strokeDashoffset: L * (1 - k / LAST_COMMIT) }}
      />
      <text x={G.empty[0]} y={G.empty[1]} textAnchor="middle" className="s-lab" style={{ opacity: cloned ? 0 : 1 }}>
        {m.empty}
      </text>
      {IN.map((files, i) => {
        const p = G.pos(i, cloned ? 1 : 0);
        return (
          <Card
            key={`clone-${i}`}
            G={G}
            i={i}
            seed={40 + i}
            files={files}
            style={{
              transitionDelay: cloned ? `${i * 110}ms` : "0ms",
              transform: tr(p.x, p.y),
              opacity: cloned ? 1 : 0,
            }}
          />
        );
      })}
      {IN.map((files, i) => {
        const visible = i <= k;
        const p = G.pos(visible ? i : Math.max(0, i - 1), 0);
        const snap = pending.includes(i);
        return (
          <Card
            key={`top-${i}`}
            G={G}
            i={i}
            seed={10 + i}
            files={snap ? IN[i - 1] : files}
            snap={snap}
            style={{ transitionDelay: "0ms", transform: tr(p.x, p.y), opacity: visible ? 1 : 0 }}
          />
        );
      })}
      <g style={{ transform: tr(hp.x, hp.y) }}>
        <SelBox x={-8} y={-8} w={G.cw + 16} h={G.ch + 16} />
        <text x={G.cw - 20} y={22} textAnchor="end" className="s-headtxt">
          {m.head}
        </text>
      </g>
    </svg>
  );
}

/** Figura A: el historial de git, un commit por paso; empieza en HEAD (paso 4) y el 5 es el clone */
export function GitHistory({ name, wide, label, caption }: FigureProps) {
  const [step, setStep] = useState(LAST_COMMIT);
  // Hojas que acaban de entrar: muestran los archivos del commit anterior y después cambian
  const [pending, setPending] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: number) {
    clearTimeout(timer.current);
    const from = Math.min(step, LAST_COMMIT);
    const to = Math.min(next, LAST_COMMIT);
    const entering: number[] = [];
    if (!prefersReducedMotion()) for (let i = Math.max(1, from + 1); i <= to; i++) entering.push(i);
    setStep(next);
    setPending(entering);
    if (entering.length) timer.current = setTimeout(() => setPending([]), 720);
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} step={step} pending={pending} label={label} />
        <Scene G={NARROW} step={step} pending={pending} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <Stepper count={5} index={step} label={rich(m.steps[step])} onChange={change} />
        {caption && <figcaption>{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

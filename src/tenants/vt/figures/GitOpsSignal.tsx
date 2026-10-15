"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, tr, type FigureProps } from "./parts";

const m = copy.figures.gitopsSignal;
type Route = "open" | "guarded";
type Geo = {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  repo: number;
  signal: number;
  pods: number;
  rail: number;
};

const WIDE: Geo = { narrow: false, W: 720, H: 190, M: 20, repo: 66, signal: 382, pods: 658, rail: 141 };
const NARROW: Geo = { narrow: true, W: 380, H: 196, M: 12, repo: 43, signal: 211, pods: 344, rail: 145 };

/** Una locomotora pequeña, dibujada con las mismas hojas y nodos de las otras figuras. */
function Train() {
  return (
    <g className="gt-small-train" aria-hidden="true">
      <Drawn pts={rectPts(-82, -25, 33, 18)} seed={41} />
      <Drawn pts={rectPts(-44, -30, 27, 23)} seed={42} />
      <path className="s-fill" d="M-17 -21H-8L0 -7H-17Z" />
      <path className="s-ink" d="M-17 -21H-8L0 -7H-17ZM-11 -21V-32H-6V-19M-84 -6H2" />
      <rect className="gt-train-payload" x="-74" y="-20" width="8" height="8" />
      <path className="s-ink-thin" d="M-39 -24H-24V-16H-39Z" />
      {[-69, -54, -34, -10].map((x) => <Node key={x} cx={x} cy={0} r={4.5} />)}
    </g>
  );
}

function Scene({ G, guarded, mini = false }: { G: Geo; guarded: boolean; mini?: boolean }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const trainX = guarded ? G.signal - 28 : G.pods - 27;

  return (
    <svg className={`ink ${mini ? (G.narrow ? "mini-n" : "mini-w") : (G.narrow ? "geo-n" : "geo-w")}`} viewBox={viewBox} role={mini ? undefined : "img"} aria-hidden={mini || undefined} aria-label={mini ? undefined : guarded ? m.guardedDiagram : m.openDiagram}>
      <Paper vb={vb} step={20} />
      <text x={G.repo} y={33} textAnchor="middle" className="s-lab">{m.origin}</text>
      <text x={G.signal} y={33} textAnchor="middle" className="s-lab">{m.admission}</text>
      <text x={G.pods} y={33} textAnchor="middle" className="s-lab">{m.destination}</text>
      <Glyph name="repo" x={G.repo - 11} y={60} s={22} />
      <Glyph name="server" x={G.pods - 12} y={59} s={24} />
      <path className="s-guide" d={`M${G.repo} 86V${G.rail - 11}M${G.pods} 86V${G.rail - 11}`} />
      <path className="gt-rail-ties" d={`M18 ${G.rail + 4}H${G.W - 18}`} />
      <path className="gt-rail-line" d={`M18 ${G.rail + 4}H${G.W - 18}`} />
      <g className="gt-signal-ink" aria-hidden="true">
        <path className="s-ink-thin" d={`M${G.signal} ${G.rail + 2}V91`} />
        <Node cx={G.signal} cy={83} r={12} />
        <circle className={guarded ? "gt-light-stop" : "gt-light-go"} cx={G.signal} cy={83} r={6} />
      </g>
      <g className="gt-train-position" style={{ transform: tr(trainX, G.rail) }} aria-hidden="true">
        <Train />
      </g>
      <circle className={guarded ? "gt-pod-blocked" : "gt-pod-running"} cx={G.pods} cy={G.rail + 4} r={5} aria-hidden="true" />
      {guarded && <path className="s-x-bad" d={`M${G.pods - 3} ${G.rail + 1}l6 6m0 -6l-6 6`} aria-hidden="true" />}
    </svg>
  );
}

/** La misma vía en dos namespaces: el resultado cambia al exigir restricted. */
export function GitOpsSignal({ name, wide, caption }: FigureProps) {
  const [route, setRoute] = useState<Route>("open");
  const seg = useRef<HTMLDivElement>(null);
  const guarded = route === "guarded";

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = guarded ? "open" : "guarded";
    setRoute(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-route="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.choose} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.modeLabel}</span>
        <button type="button" role="radio" aria-checked={!guarded} tabIndex={guarded ? -1 : 0} data-route="open" onClick={() => setRoute("open")}>{m.open}</button>
        <button type="button" role="radio" aria-checked={guarded} tabIndex={guarded ? 0 : -1} data-route="guarded" onClick={() => setRoute("guarded")}>{m.guarded}</button>
      </div>
      <div className="fig-canvas">
        <Scene G={WIDE} guarded={guarded} />
        <Scene G={NARROW} guarded={guarded} />
        <Marks />
      </div>
      <div className="fig-foot">
        <p className="fig-result" aria-live="polite">
          <b className={guarded ? undefined : "fig-bad"}>{guarded ? m.guardedTitle : m.openTitle}</b>
          {` ${guarded ? m.guardedSubtitle : m.openSubtitle}`}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

/** La escena inicial del laboratorio, condensada para «Lo último». */
export function MiniGitOpsSignal({ label }: { label: string }) {
  return (
    <div className="fig-canvas fig-mini gt-mini" data-figure="gitops-signal" role="img" aria-label={label}>
      <div className="gt-mini-head" aria-hidden="true">
        <span>{m.miniManifest}</span>
        <span>{m.miniSync}</span>
      </div>
      <Scene G={WIDE} guarded={false} mini />
      <Scene G={NARROW} guarded={false} mini />
      <div className="gt-mini-foot" aria-hidden="true">
        <strong>{m.openTitle}</strong>
        <span>{m.miniMount}</span>
      </div>
      <Marks />
    </div>
  );
}

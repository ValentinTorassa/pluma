"use client";

import { useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { frame, GLYPHS, rectPts, type Pt } from "./ink";
import { Drawn, FigureFrame, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";
import { TfOutput } from "./TfOutput";

const m = copy.figures.standbyReplace;

export type ReplaceStep = keyof typeof m.steps;
export const STEPS: ReplaceStep[] = ["sin", "con", "replace"];

/* ---------- el modelo ---------- */

export type ReplacePlan = {
  /** `lifecycle { ignore_changes = [ami, user_data, user_data_base64] }` en el módulo */
  ignore: boolean;
  /** Qué hace el plan con aws_instance.standby */
  action: "replace" | "none" | "replace-requested";
  /** La instancia actual sigue, con lo que tiene preparado */
  kept: boolean;
  /** La AMI de la instancia que queda si se aplica */
  ami: string;
};

/**
 * Debian publicó una imagen nueva: la búsqueda de la AMI cambia. Sin
 * ignore_changes, una AMI nueva fuerza el reemplazo; con ignore_changes el
 * plan deja la instancia como está, y reconstruirla se pide con -replace.
 */
export function planAt(step: ReplaceStep): ReplacePlan {
  if (step === "sin") return { ignore: false, action: "replace", kept: false, ami: m.ami.new };
  if (step === "con") return { ignore: true, action: "none", kept: true, ami: m.ami.old };
  return { ignore: true, action: "replace-requested", kept: false, ami: m.ami.new };
}

/** Ancho de una etiqueta en mono de 10,5 px */
export const tagWidth = (text: string) => Math.round(text.length * 6.7 + 12);

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Anchor = "start" | "middle" | "end";
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  heads: Record<keyof typeof m.heads, Pt>;
  search: Box;
  /** Renglones de la búsqueda */
  filter: Pt;
  newest: Pt;
  before: Pt;
  oldAmi: Pt;
  now: Pt;
  newAmi: Pt;
  code: Box;
  /** Primer renglón del código y separación entre renglones del lifecycle */
  codeLines: { resource: Pt; ami: Pt; life: Pt; gap: number };
  ghost: Box;
  /** Flechas: de la búsqueda al código y del código a cada instancia */
  feed: [Pt, Pt];
  toOld: [Pt, Pt];
  toNew: [Pt, Pt];
  check: Pt;
  /** El -replace junto a la flecha de la instancia nueva (en la ancha no entra entre las cajas) */
  flag: { x: number; y: number; anchor: Anchor } | null;
  verdict: Pt;
  old: Box;
  fresh: Box;
};

const PAD = 12;

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 176,
  heads: { search: [0, 13], code: [214, 13], instance: [524, 13] },
  search: { x: 0, y: 26, w: 170, h: 150 },
  filter: [12, 50],
  newest: [12, 66],
  before: [12, 96],
  oldAmi: [12, 112],
  now: [12, 136],
  newAmi: [12, 152],
  code: { x: 214, y: 26, w: 250, h: 150 },
  codeLines: { resource: [226, 50], ami: [226, 68], life: [226, 98], gap: 16 },
  ghost: { x: 222, y: 84, w: 234, h: 76 },
  feed: [
    [170, 101],
    [214, 101],
  ],
  toOld: [
    [464, 64],
    [524, 64],
  ],
  toNew: [
    [464, 135],
    [524, 135],
  ],
  check: [494, 64],
  flag: null,
  verdict: [716, 8],
  old: { x: 524, y: 26, w: 196, h: 76 },
  fresh: { x: 524, y: 110, w: 196, h: 50 },
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 402,
  heads: { search: [0, 13], code: [0, 150], instance: [0, 316] },
  search: { x: 0, y: 26, w: 380, h: 86 },
  filter: [12, 50],
  newest: [12, 68],
  before: [176, 46],
  oldAmi: [176, 62],
  now: [176, 84],
  newAmi: [176, 100],
  code: { x: 0, y: 160, w: 380, h: 124 },
  codeLines: { resource: [12, 184], ami: [12, 202], life: [12, 226], gap: 15 },
  ghost: { x: 8, y: 212, w: 364, h: 66 },
  feed: [
    [190, 112],
    [190, 160],
  ],
  toOld: [
    [150, 284],
    [150, 330],
  ],
  toNew: [
    [232, 284],
    [232, 330],
  ],
  check: [150, 307],
  flag: { x: 224, y: 311, anchor: "end" },
  verdict: [380, 312],
  old: { x: 0, y: 330, w: 186, h: 72 },
  fresh: { x: 194, y: 330, w: 186, h: 56 },
};

const SEEDS = { search: 1701, code: 1702, old: 1703, fresh: 1704 };

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

/** SVG junta los espacios: la sangría del HCL va como corrimiento, a 7 unidades por carácter (mono de 11 px, medido) */
export const indent = (l: string) => (l.length - l.trimStart().length) * 7;

/** Punta de flecha en `to`, mirando desde `from` */
function head([from, to]: [Pt, Pt]): string {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const [dx, dy] = [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
  return `M${to[0] - dx * 7 - dy * 4} ${to[1] - dy * 7 + dx * 4}L${to[0]} ${to[1]}L${to[0] - dx * 7 + dy * 4} ${to[1] - dy * 7 - dx * 4}`;
}

const line = ([a, b]: [Pt, Pt]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;

function Scene({ G, step, label }: { G: Geo; step: ReplaceStep; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const p = planAt(step);
  const tone = p.action === "replace" ? "bad" : p.action === "none" ? "ok" : "ink";
  const verdict = m.verdict[step];
  const vw = tagWidth(verdict);
  const lost = p.action === "replace";
  const { search, code, old, fresh } = G;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {(Object.keys(m.heads) as (keyof typeof m.heads)[]).map((k) => (
        <text key={k} x={G.heads[k][0]} y={G.heads[k][1]} className="s-title">
          {m.heads[k]}
        </text>
      ))}

      {/* la búsqueda: la imagen más nueva de Debian para arm64 cambió */}
      <Drawn pts={rectPts(search.x, search.y, search.w, search.h)} seed={SEEDS.search} />
      <text x={G.filter[0]} y={G.filter[1]} className="sb-val">
        {m.search.filter}
      </text>
      <text x={G.newest[0]} y={G.newest[1]} className="s-lab">
        {m.search.newest}
      </text>
      <text x={G.before[0]} y={G.before[1]} className="s-lab">
        {m.search.before}
      </text>
      <text x={G.oldAmi[0]} y={G.oldAmi[1]} className="sb-val gone">
        {m.ami.old}
      </text>
      <text x={G.now[0]} y={G.now[1]} className="s-lab">
        {m.search.now}
        <tspan className="sb-fresh">{m.search.fresh}</tspan>
      </text>
      <text x={G.newAmi[0]} y={G.newAmi[1]} className="sb-val strong">
        {m.ami.new}
      </text>
      <path d={line(G.feed)} className="s-link" />
      <path d={head(G.feed)} className="sb-head" />

      {/* el módulo: con o sin ignore_changes */}
      <Drawn pts={rectPts(code.x, code.y, code.w, code.h)} seed={SEEDS.code} />
      <text x={G.codeLines.resource[0]} y={G.codeLines.resource[1]} className="sb-val strong">
        {m.code.resource}
      </text>
      <text x={G.codeLines.ami[0]} y={G.codeLines.ami[1]} className="sb-val">
        {m.code.ami}
      </text>
      <g style={shown(p.ignore)}>
        {m.code.lifecycle.map((l, i) => (
          <text key={l} x={G.codeLines.life[0] + indent(l)} y={G.codeLines.life[1] + i * G.codeLines.gap} className="sb-val">
            {l.trimStart()}
          </text>
        ))}
      </g>
      <g style={shown(!p.ignore)}>
        <rect x={G.ghost.x} y={G.ghost.y} width={G.ghost.w} height={G.ghost.h} rx={4} className="sd-ghost" />
        <text x={G.ghost.x + G.ghost.w / 2} y={G.ghost.y + G.ghost.h / 2 + 4} textAnchor="middle" className="s-lab sb-none">
          {m.code.none}
        </text>
      </g>

      {/* del plan a la instancia actual (pedido el reemplazo, queda atrás como ella) */}
      <g style={{ opacity: p.action === "replace-requested" ? 0.4 : 1 }}>
        <path d={line(G.toOld)} className={p.action === "replace" ? "s-link sb-bad" : "s-link"} />
        <path d={head(G.toOld)} className={p.action === "replace" ? "sb-head sb-bad" : "sb-head"} />
      </g>
      <g style={shown(p.action === "none")}>
        <circle cx={G.check[0]} cy={G.check[1]} r={8} className="s-fill" />
        <path d={GLYPHS.check[0].d} transform={`translate(${G.check[0] - 6} ${G.check[1] - 6}) scale(0.75)`} className="jw-mark-ok" />
      </g>

      {/* y a la nueva: propuesta sin querer, o pedida */}
      <g style={shown(p.action !== "none")}>
        <path d={line(G.toNew)} className={p.action === "replace" ? "sb-planned sb-bad" : "s-link"} />
        <path d={head(G.toNew)} className={p.action === "replace" ? "sb-head sb-bad" : "sb-head"} />
      </g>
      {G.flag && (
        <text x={G.flag.x} y={G.flag.y} textAnchor={G.flag.anchor} className="sb-val strong" style={shown(p.action === "replace-requested")}>
          {m.flag}
        </text>
      )}

      {/* la instancia de hoy, con lo que tiene preparado */}
      <Drawn pts={rectPts(old.x, old.y, old.w, old.h)} seed={SEEDS.old} />
      <g style={{ opacity: p.action === "replace-requested" ? 0.4 : 1 }}>
        <text x={old.x + PAD} y={old.y + 20} className="sb-val">
          {m.instance.id}
        </text>
        <text x={old.x + PAD} y={old.y + 36} className="sb-val">
          {m.ami.old}
        </text>
        <g className={lost ? "sb-chip lost" : "sb-chip ink"}>
          <rect x={old.x + PAD} y={old.y + 47} width={tagWidth(m.instance.staged)} height={15} rx={3} />
          <text x={old.x + PAD + tagWidth(m.instance.staged) / 2} y={old.y + 58} textAnchor="middle">
            {m.instance.staged}
          </text>
        </g>
        <text x={old.x + PAD + tagWidth(m.instance.staged) + 8} y={old.y + 58} className="sb-lost" style={shown(lost)}>
          {m.instance.lost}
        </text>
      </g>

      {/* la instancia nueva: punteada si es lo que haría el plan, firme si la pediste */}
      <rect x={fresh.x} y={fresh.y} width={fresh.w} height={fresh.h} rx={3} className="sb-ghost-bad" style={shown(p.action === "replace")} />
      <g style={shown(p.action === "replace-requested")}>
        <Drawn pts={rectPts(fresh.x, fresh.y, fresh.w, fresh.h)} seed={SEEDS.fresh} />
      </g>
      <g style={{ opacity: p.action === "none" ? 0 : p.action === "replace" ? 0.75 : 1 }}>
        <text x={fresh.x + PAD} y={fresh.y + 20} className="sb-val">
          {m.instance.unknown}
        </text>
        <text x={fresh.x + PAD} y={fresh.y + 37} className="sb-val strong">
          {m.ami.new}
        </text>
      </g>

      {/* qué hace el plan con la instancia */}
      <g className={`sb-tag ${tone}`}>
        <rect x={G.verdict[0] - vw} y={G.verdict[1] - 8} width={vw} height={16} rx={4} />
        <text x={G.verdict[0] - vw / 2} y={G.verdict[1] + 3.5} textAnchor="middle">
          {verdict}
        </text>
      </g>
    </svg>
  );
}

/** Figura: una imagen nueva de Debian, el plan sin y con ignore_changes, y el reemplazo pedido a mano */
export function StandbyReplace({ name, wide, label, caption }: FigureProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} step={step} label={label} />
        <Scene G={NARROW} step={step} label={label} />
        <TfOutput id={step} kicker={m.kicker} prompt={m.prompt} command={m.commands[step]} lines={m.output[step]} />
        <Marks />
      </div>
      <div className="fig-foot">
        <Stepper count={STEPS.length} index={index} label={rich(m.steps[step])} onChange={setIndex} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, GLYPHS, rectPts, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.blackiceModos;

export type Mode = "accept" | "block" | "ask";
export const MODES: Mode[] = ["accept", "block", "ask"];

export type ConnId = keyof typeof m.conns;
/**
 * Las conexiones de la corrida P5-10 (6/11/2026, blackice 0.4.5), en orden.
 * `agentMs`: lo que tardó Claude Code en negarla. `remembered`: se cayó como
 * `denied;remembered`, sin evento ni hook.
 */
export const CONNS: { id: ConnId; rule: boolean; agentMs: number | null; remembered: boolean }[] = [
  { id: "rule", rule: true, agentMs: null, remembered: false },
  { id: "tele", rule: false, agentMs: 3780, remembered: false },
  { id: "again", rule: false, agentMs: null, remembered: true },
  { id: "wiki", rule: false, agentMs: 3460, remembered: false },
  { id: "approved", rule: false, agentMs: null, remembered: false },
];

/** pass: pasa (regla o aprobación); logged: pasa sin regla y queda en el log; el resto se cae en el filtro */
export type Outcome = "pass" | "logged" | "drop" | "denied" | "remembered";

export function outcome(mode: Mode, i: number): Outcome {
  const c = CONNS[i];
  if (c.rule || c.id === "approved") return "pass";
  if (mode === "accept") return "logged";
  if (mode === "block") return "drop";
  return c.agentMs !== null ? "denied" : c.remembered ? "remembered" : "drop";
}

/** Cuántas conexiones juegan: la quinta solo existe en ask, después de aprobar */
export const connCount = (mode: Mode, approved: boolean) => (mode === "ask" && approved ? CONNS.length : CONNS.length - 1);

/* ---------- simulación ---------- */

const FIRST = 0.2;
const ENTRY = 0.35;
const TO_GATE = 0.7;
const TO_NET = 0.8;
const DOWN = 0.45;
const UP = 0.45;
/** Segundos de figura por segundo de la corrida: 3.780 ms se ven en 1,9 s */
const AGENT_SCALE = 0.5;
/** Cuánto se ve el deny en la caja del agente antes de volver al filtro */
const ANSWER = 0.55;
const PARK = 0.8;
const FADE = 0.3;
const GAP_PASS = 0.3;
const GAP_DROP = 0.9;

export type Planned = {
  index: number;
  outcome: Outcome;
  start: number;
  gate: number;
  /** Llega al agente, el agente contesta y vuelve al filtro (solo `denied`) */
  agentIn: number;
  answered: number;
  back: number;
  /** Llega a internet, o se cae en el filtro */
  end: number;
};

export function schedule(mode: Mode, approved: boolean): Planned[] {
  let s = FIRST;
  const out: Planned[] = [];
  for (let index = 0; index < connCount(mode, approved); index++) {
    const o = outcome(mode, index);
    const gate = s + ENTRY + TO_GATE;
    const ms = CONNS[index].agentMs;
    const agentIn = gate + DOWN;
    const answered = o === "denied" && ms !== null ? agentIn + (ms / 1000) * AGENT_SCALE : agentIn;
    const back = answered + ANSWER + UP;
    const end = o === "pass" || o === "logged" ? gate + TO_NET : o === "denied" ? back : gate;
    out.push({ index, outcome: o, start: s, gate, agentIn, answered, back, end });
    s = end + (o === "pass" || o === "logged" ? GAP_PASS : GAP_DROP);
  }
  return out;
}

export function modosEnd(mode: Mode, approved: boolean): number {
  const plan = schedule(mode, approved);
  const last = plan[plan.length - 1];
  return last.end + (last.outcome === "pass" || last.outcome === "logged" ? 0.5 : PARK + FADE + 0.1);
}

/** Dónde va el punto: de la fila al recorrido, al filtro, a internet, o baja al agente y vuelve */
export type Leg = "entry" | "gate" | "net" | "down" | "agent" | "up" | "park";
export type ChipState = "waiting" | "active" | Outcome;
export type ModosFrame = {
  chips: ChipState[];
  dot: { index: number; leg: Leg; p: number; opacity: number; denied: boolean } | null;
  agent: { index: number; ms: number; answered: boolean } | null;
  /** La × en el filtro y su motivo */
  mark: { index: number; outcome: Exclude<Outcome, "pass" | "logged">; opacity: number } | null;
  passed: number;
  stopped: number;
  byAgent: number;
  last: { index: number; outcome: Outcome } | null;
  done: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Función pura del tiempo, el modo y la aprobación: el servidor y el navegador dibujan lo mismo */
export function simulateModos(mode: Mode, approved: boolean, t: number): ModosFrame {
  const plan = schedule(mode, approved);
  const f: ModosFrame = {
    chips: [],
    dot: null,
    agent: null,
    mark: null,
    passed: 0,
    stopped: 0,
    byAgent: 0,
    last: null,
    done: t >= modosEnd(mode, approved),
  };
  for (const c of plan) {
    const { index, outcome: o } = c;
    if (t < c.start) {
      f.chips.push("waiting");
      continue;
    }
    if (t < c.end) {
      f.chips.push("active");
      const ms = CONNS[index].agentMs ?? 0;
      if (t < c.start + ENTRY) f.dot = { index, leg: "entry", p: (t - c.start) / ENTRY, opacity: 1, denied: false };
      else if (t < c.gate) f.dot = { index, leg: "gate", p: (t - c.start - ENTRY) / TO_GATE, opacity: 1, denied: false };
      else if (o === "pass" || o === "logged") f.dot = { index, leg: "net", p: (t - c.gate) / TO_NET, opacity: 1, denied: false };
      else if (t < c.agentIn) f.dot = { index, leg: "down", p: (t - c.gate) / DOWN, opacity: 1, denied: false };
      else if (t < c.answered + ANSWER) {
        f.dot = { index, leg: "agent", p: 1, opacity: 1, denied: t >= c.answered };
        f.agent = { index, ms: Math.min(ms, Math.round(((t - c.agentIn) / AGENT_SCALE) * 1000)), answered: t >= c.answered };
      } else {
        f.dot = { index, leg: "up", p: (t - c.answered - ANSWER) / UP, opacity: 1, denied: true };
        f.agent = { index, ms, answered: true };
      }
      continue;
    }
    f.chips.push(o);
    f.last = { index, outcome: o };
    if (o === "pass" || o === "logged") {
      f.passed++;
      continue;
    }
    f.stopped++;
    if (o === "denied") f.byAgent++;
    const since = t - c.end;
    if (since < PARK + FADE) {
      f.dot = { index, leg: "park", p: 1, opacity: 1 - clamp01((since - PARK) / FADE), denied: true };
      f.mark = { index, outcome: o, opacity: 1 - clamp01((since - PARK) / FADE) };
      if (o === "denied" && since < PARK) f.agent = { index, ms: CONNS[index].agentMs ?? 0, answered: true };
    }
  }
  return f;
}

/** El cuadro inicial: la corrida en ask, terminada */
export const MODOS_START = modosEnd("ask", false);

/** 3780 → "3.780", como se escriben los miles en es-AR (igual en servidor y navegador) */
export function ms(n: number): string {
  return n < 1000 ? String(n) : `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, "0")}`;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Anchor = "start" | "middle" | "end";
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  chip: (i: number) => Box;
  /** De dónde sale el punto hacia el recorrido (null: aparece en la punta) */
  out: ((i: number) => Pt) | null;
  start: Pt;
  gate: Pt;
  gateBox: Box;
  title: { x: number; y: number; anchor: Anchor };
  reason: { x: number; y: number; anchor: Anchor };
  net: Pt;
  netLabel: { x: number; y: number; anchor: Anchor };
  agent: Box;
  /** Donde espera el punto, sobre el borde de la caja del agente */
  agentAt: Pt;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 236,
  chip: (i) => ({ x: 0, y: 6 + i * 40, w: 276, h: 28 }),
  out: (i) => [276, 20 + i * 40],
  start: [304, 100],
  gate: [482, 100],
  gateBox: { x: 474, y: 54, w: 16, h: 92 },
  title: { x: 482, y: 30, anchor: "middle" },
  reason: { x: 498, y: 88, anchor: "start" },
  net: [690, 100],
  netLabel: { x: 690, y: 128, anchor: "middle" },
  agent: { x: 512, y: 168, w: 204, h: 62 },
  agentAt: [526, 199],
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 424,
  chip: (i) => ({ x: 0, y: 4 + i * 34, w: 380, h: 26 }),
  out: null,
  start: [40, 192],
  gate: [40, 262],
  gateBox: { x: 8, y: 256, w: 64, h: 12 },
  title: { x: 86, y: 258, anchor: "start" },
  reason: { x: 86, y: 236, anchor: "start" },
  net: [40, 400],
  netLabel: { x: 62, y: 404, anchor: "start" },
  agent: { x: 150, y: 300, w: 230, h: 60 },
  agentAt: [166, 330],
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function dotAt(G: Geo, d: NonNullable<ModosFrame["dot"]>): Pt {
  switch (d.leg) {
    case "entry":
      return G.out ? lerp(G.out(d.index), G.start, d.p) : G.start;
    case "gate":
      return lerp(G.start, G.gate, d.p);
    case "net":
      return lerp(G.gate, G.net, d.p);
    case "down":
      return lerp(G.gate, G.agentAt, d.p);
    case "agent":
      return G.agentAt;
    case "up":
      return lerp(G.agentAt, G.gate, d.p);
    case "park":
      return G.gate;
  }
}

function Scene({ G, mode, approved, f, dots, label }: { G: Geo; mode: Mode; approved: boolean; f: ModosFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const A = G.agent;
  const asks = mode === "ask";
  const d = f.dot;
  const at = d && dotAt(G, d);
  // sin pata de entrada (angosta), el punto aparece en la punta del recorrido
  const fadeIn = d && d.leg === "entry" && !G.out ? d.p : 1;
  const ghost = asks && !approved;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el recorrido: de la app al filtro y a internet; del filtro al agente */}
      <path d={`M${G.start[0]} ${G.start[1]}L${G.net[0]} ${G.net[1]}`} className="s-guide" />
      <path d={`M${G.gate[0]} ${G.gate[1]}L${G.agentAt[0]} ${G.agentAt[1]}`} className="s-guide" style={shown(asks)} />
      <Node cx={G.start[0]} cy={G.start[1]} r={4} />

      {/* las conexiones, de a una */}
      {CONNS.map((c, i) => {
        const b = G.chip(i);
        const last = i === CONNS.length - 1;
        const state: ChipState | "ghost" | "hidden" = last && !asks ? "hidden" : last && ghost ? "ghost" : (f.chips[i] ?? "waiting");
        const ok = state === "pass" || state === "logged";
        const bad = state === "drop" || state === "denied" || state === "remembered";
        return (
          <g key={c.id} className={`bm-chip ${state}`} style={shown(state !== "hidden")}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={5} />
            <text x={b.x + 10} y={b.y + b.h / 2 + 4}>
              {state === "ghost" ? m.approvedGhost : m.conns[c.id]}
            </text>
            <path d={xmark(b.x + b.w - 14, b.y + b.h / 2, 4)} className="s-x" style={shown(bad)} />
            <path
              d={GLYPHS.check[0].d}
              transform={`translate(${b.x + b.w - 21} ${b.y + b.h / 2 - 7}) scale(0.85)`}
              className="jw-mark-ok"
              style={shown(ok)}
            />
          </g>
        );
      })}

      {/* el filtro */}
      <Drawn pts={rectPts(G.gateBox.x, G.gateBox.y, G.gateBox.w, G.gateBox.h)} seed={1401} />
      <text x={G.title.x} y={G.title.y} textAnchor={G.title.anchor} className="s-title">
        {m.gate}
      </text>
      <text x={G.title.x} y={G.title.y + 15} textAnchor={G.title.anchor} className="s-lab bm-mode">
        {m.gateMode(m.modes[mode])}
      </text>

      {/* internet */}
      <Glyph name="globe" x={G.net[0] - 9} y={G.net[1] - 9} s={18} />
      <text x={G.netLabel.x} y={G.netLabel.y} textAnchor={G.netLabel.anchor} className="s-lab">
        {m.net}
      </text>

      {/* el agente: solo responde en ask */}
      <g style={shown(asks)}>
        <Drawn pts={rectPts(A.x, A.y, A.w, A.h)} seed={1402} />
      </g>
      <rect x={A.x} y={A.y} width={A.w} height={A.h} rx={2} className="sd-ghost" style={shown(!asks)} />
      <text x={G.agentAt[0] + 16} y={A.y + 25} className={asks ? "s-title" : "s-lab"}>
        {m.agent}
        <tspan className="s-lab" dx={7}>
          {m.agentSub}
        </tspan>
      </text>
      <text x={G.agentAt[0] + 16} y={A.y + 46} className={f.agent ? (f.agent.answered ? "bm-answer" : "s-lab bm-wait") : "s-lab"}>
        {!asks ? m.agentOff : !f.agent ? m.agentIdle : f.agent.answered ? m.answer(ms(f.agent.ms)) : m.waiting(ms(f.agent.ms))}
      </text>

      {/* la × en el filtro y el motivo */}
      {f.mark && (
        <g style={{ ...STILL, opacity: f.mark.opacity }}>
          <path d={xmark(G.gate[0], G.gate[1], 6)} className="s-x-bad" style={STILL} />
          <text x={G.reason.x} y={G.reason.y} textAnchor={G.reason.anchor} className="bm-reason" style={STILL}>
            {m.reasons[f.mark.outcome]}
          </text>
        </g>
      )}

      {/* el punto en camino */}
      {dots && d && at && (
        <circle
          cx={at[0]}
          cy={at[1]}
          r={5.5}
          className={d.denied ? "bm-dot denied" : "bm-dot"}
          style={{ ...STILL, opacity: d.opacity * fadeIn }}
        />
      )}
    </svg>
  );
}

function result(mode: Mode, approved: boolean, f: ModosFrame): string {
  const r = m.results;
  if (f.done) return mode === "ask" && approved ? r.approved : r.done[mode];
  if (f.agent) return !f.agent.answered ? r.waiting : CONNS[f.agent.index].id === "tele" ? r.tele : r.wiki;
  if (!f.last) return r.start[mode];
  const id = CONNS[f.last.index].id;
  switch (f.last.outcome) {
    case "pass":
      return id === "rule" ? r.rule : r.approved;
    case "logged":
      return r.logged;
    case "drop":
      return r.drop;
    case "remembered":
      return r.remembered;
    case "denied":
      return id === "tele" ? r.tele : r.wiki;
  }
}

/** Figura: las conexiones de la corrida P5-10 en los tres modos; en ask las responde Claude Code */
export function BlackiceModos({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<Mode>("ask");
  const [approved, setApproved] = useState(false);
  const [played, setPlayed] = useState(false);
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(MODOS_START);
  const seg = useRef<HTMLDivElement>(null);
  const end = modosEnd(mode, approved);
  const f = simulateModos(mode, approved, Math.min(t, end));

  // al terminar la corrida el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function run(next: Mode, ok: boolean, from = 0) {
    setMode(next);
    setApproved(ok);
    setPlayed(true);
    // con reduced motion se salta al final: se entiende igual
    if (prefersReducedMotion()) {
      if (playing) toggle();
      reset(modosEnd(next, ok));
      return;
    }
    reset(from);
    if (!playing) play();
  }

  function pick(next: Mode) {
    if (next !== mode) run(next, false);
  }

  function approve() {
    // solo juega la quinta: las anteriores ya terminaron
    run("ask", true, schedule("ask", true)[CONNS.length - 1].start);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const step = e.key === "ArrowRight" ? 1 : MODES.length - 1;
    const next = MODES[(MODES.indexOf(mode) + step) % MODES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  const canApprove = mode === "ask" && !approved && f.done;

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.mode} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.modeLabel}</span>
        {MODES.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={mode === o}
            tabIndex={mode === o ? 0 : -1}
            data-mode={o}
            onClick={() => pick(o)}
          >
            {m.modes[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} mode={mode} approved={approved} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} mode={mode} approved={approved} f={f} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          <button type="button" className="plain" onClick={() => run(mode, false)}>
            {played ? `↺ ${m.again}` : `▶ ${m.play}`}
          </button>
          {canApprove && (
            <button type="button" className="plain" onClick={approve}>
              {m.approve}
            </button>
          )}
        </div>
        <div className="counter" aria-hidden="true">
          <span>
            {m.counters.passed}
            <b>{f.passed}</b>
          </span>
          <span>
            {m.counters.stopped}
            <b>{f.stopped}</b>
          </span>
          <span>
            {m.counters.agent}
            <b>{f.byAgent}</b>
          </span>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(mode, approved, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

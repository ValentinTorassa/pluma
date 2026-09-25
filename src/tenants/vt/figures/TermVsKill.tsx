"use client";

import { useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, SelBox, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, lerp, sent, STILL, usePlayClock } from "./sim";

const m = copy.figures.termVsKill;

export type Signal = "term" | "kill";
const SIGNALS: Signal[] = ["term", "kill"];
export type SentSignal = { kind: Signal; t: number } | null;

/* ---------- simulación ---------- */

/** Un pedido cada segundo */
const REQ = { period: 1, offset: 0.15 } as const;
/** Lo que tarda un pedido en cruzar la conexión, y en atenderse */
const TRAVEL = 1;
const WORK = 0.9;
/** Cada tanto el programa pasa lo que tiene en memoria al disco */
const FLUSH_EVERY = { period: 3, offset: 1.4 } as const;
const FLUSH_T = 0.6;
/** Lo que tarda la señal en bajar por la flecha y llegar al proceso */
const SIGNAL_T = 0.4;
const EXIT_AFTER = 0.3;
const STALE_AFTER = 1;
/** El cuadro inicial: un pedido en vuelo, otro atendiéndose, algo ya guardado */
export const TK_START = 3.3;

type Where = "conn" | "slot" | "flush" | "edge";
export type KillDot = { key: string; kind: "req" | "res" | "work" | "save"; on: Where; p: number };
export type KillFlash = { key: string; on: Where; opacity: number; bad: boolean };
export type KillFrame = {
  dots: KillDot[];
  flashes: KillFlash[];
  served: number;
  cut: number;
  refused: number;
  memory: number;
  saved: number;
  proc: "alive" | "draining" | "exited" | "killed";
  lock: "held" | "removed" | "stale";
  stale: boolean;
  /** Avance de la señal por la flecha (0 a 1), o null si no está bajando */
  signal: number | null;
};

/**
 * Qué pasa en el segundo `t` si en `sig.t` se mandó una señal. Con TERM el
 * programa deja de aceptar pedidos, termina los que tenía, guarda y borra el
 * lock; con KILL el kernel lo saca: lo que estaba atendiendo se corta, lo que
 * tenía en memoria se pierde y el lock queda. Función pura del tiempo.
 */
export function simulateKill(sig: SentSignal, t: number): KillFrame {
  const te = sig ? sig.t + SIGNAL_T : Infinity;
  const kill = sig?.kind === "kill";
  const reqs = sent(Number.isFinite(te) ? Math.max(t, te) : t, REQ).map((s) => ({ s, ta: s + TRAVEL, we: s + TRAVEL + WORK }));
  const accepted = (r: { ta: number }) => r.ta < te;
  const isCut = (r: { ta: number; we: number }) => kill && accepted(r) && r.we > te;
  const served = reqs.filter((r) => accepted(r) && !isCut(r));
  const drainEnd = sig?.kind === "term" ? Math.max(te, ...served.map((r) => r.we)) : te;

  const f: KillFrame = {
    dots: [],
    flashes: [],
    served: 0,
    cut: 0,
    refused: 0,
    memory: 0,
    saved: 0,
    proc: "alive",
    lock: "held",
    stale: false,
    signal: sig && t >= sig.t && t < te ? (t - sig.t) / SIGNAL_T : null,
  };

  for (const r of reqs) {
    if (r.s > t) continue;
    const key = `r${r.s}`;
    if (t < r.ta) {
      f.dots.push({ key, kind: "req", on: "conn", p: (t - r.s) / TRAVEL });
    } else if (!accepted(r)) {
      // llegó cuando ya no había nadie escuchando
      f.refused++;
      if (t < r.ta + FLASH) f.flashes.push({ key, on: "edge", opacity: 1 - (t - r.ta) / FLASH, bad: false });
    } else if (isCut(r)) {
      if (t < te) f.dots.push({ key, kind: "work", on: "slot", p: 0 });
      else {
        f.cut++;
        if (t < te + FLASH) f.flashes.push({ key, on: "slot", opacity: 1 - (t - te) / FLASH, bad: true });
      }
    } else if (t < r.we) {
      f.dots.push({ key, kind: "work", on: "slot", p: 0 });
    } else if (t < r.we + TRAVEL) {
      f.dots.push({ key, kind: "res", on: "conn", p: 1 - (t - r.we) / TRAVEL });
    } else {
      f.served++;
    }
  }

  // memoria y disco: cada pedido atendido deja un cambio en memoria; cada flush se lleva todo lo que había
  const done = served.map((r) => r.we);
  const upTo = (x: number) => done.filter((w) => w <= x).length;
  const flushes = sent(Math.min(t, te), FLUSH_EVERY);
  if (sig?.kind === "term" && drainEnd <= t) flushes.push(drainEnd);
  let taken = 0;
  for (const fk of flushes) {
    const moved = upTo(fk) - taken;
    taken = upTo(fk);
    if (moved === 0) continue;
    if (t >= fk + FLUSH_T) f.saved += moved;
    else f.dots.push({ key: `f${fk}`, kind: "save", on: "flush", p: (t - fk) / FLUSH_T });
  }
  // con TERM sigue terminando pedidos después de la señal; con KILL la memoria queda como estaba
  f.memory = upTo(kill ? Math.min(t, te) : t) - taken;

  if (kill && t >= te) {
    f.proc = "killed";
    f.lock = "stale";
    f.stale = t >= te + STALE_AFTER;
  } else if (sig?.kind === "term" && t >= te) {
    const gone = drainEnd + FLUSH_T;
    f.proc = t >= gone + EXIT_AFTER ? "exited" : "draining";
    f.lock = t >= gone ? "removed" : "held";
  }
  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  client: Pt;
  clientLabel: Pt;
  conn: Cubic;
  slot: Pt;
  signal: [Pt, Pt];
  signalLabel: Pt;
  proc: Box;
  title: Pt;
  pidAt: Pt;
  memory: Box;
  status: Box;
  disk: Box;
  diskChip: Box;
  lock: Box;
  stale: Box;
  flush: Cubic;
  lockGuide: [Pt, Pt];
};

const line = (a: Pt, b: Pt) => cubic(a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b);

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 250,
  client: [18, 104],
  clientLabel: [8, 146],
  conn: line([52, 116], [200, 116]),
  slot: [222, 116],
  signal: [
    [315, 6],
    [315, 44],
  ],
  signalLabel: [327, 22],
  proc: { x: 200, y: 44, w: 230, h: 160 },
  title: [214, 68],
  pidAt: [416, 68],
  memory: { x: 240, y: 103, w: 176, h: 26 },
  status: { x: 214, y: 166, w: 176, h: 24 },
  disk: { x: 520, y: 36, w: 200, h: 80 },
  diskChip: { x: 534, y: 72, w: 176, h: 26 },
  lock: { x: 520, y: 142, w: 200, h: 62 },
  stale: { x: 200, y: 218, w: 230, h: 24 },
  flush: line([430, 108], [520, 78]),
  lockGuide: [
    [430, 150],
    [520, 172],
  ],
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 440,
  client: [18, 16],
  clientLabel: [50, 32],
  conn: line([30, 44], [30, 118]),
  slot: [30, 140],
  signal: [
    [300, 80],
    [300, 118],
  ],
  signalLabel: [312, 98],
  proc: { x: 0, y: 118, w: 380, h: 150 },
  title: [48, 142],
  pidAt: [366, 142],
  memory: { x: 48, y: 160, w: 200, h: 26 },
  status: { x: 48, y: 226, w: 190, h: 24 },
  disk: { x: 10, y: 310, w: 210, h: 80 },
  diskChip: { x: 24, y: 346, w: 190, h: 26 },
  lock: { x: 236, y: 310, w: 144, h: 80 },
  stale: { x: 10, y: 408, w: 270, h: 24 },
  flush: line([110, 268], [110, 310]),
  lockGuide: [
    [300, 268],
    [300, 310],
  ],
};

type Kind = "key" | "safe" | "dead" | "ink";

function Chip({ x, y, w, h, kind, text, style }: Box & { kind: Kind; text: string; style?: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx={4} className={`s-tag-${kind}`} />
      <text x={x + 10} y={y + h / 2 + 4} className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, sig, f, dots, label }: { G: Geo; sig: SentSignal; f: KillFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { proc: P, disk: D, lock: L, memory: Mm } = G;
  const edge = G.conn.at(G.conn.length);
  const where = (on: Where, p: number): Pt =>
    on === "conn" ? G.conn.at(G.conn.length * p) : on === "flush" ? G.flush.at(G.flush.length * p) : on === "edge" ? edge : G.slot;
  const killed = f.proc === "killed";
  const lost = killed && f.memory > 0;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      <path d={G.flush.d} className="s-guide" />
      <path d={`M${G.lockGuide[0][0]} ${G.lockGuide[0][1]}L${G.lockGuide[1][0]} ${G.lockGuide[1][1]}`} className="s-guide" style={shown(f.lock !== "removed")} />

      {/* el cliente y su conexión */}
      <Glyph name="laptop" x={G.client[0]} y={G.client[1]} s={24} />
      <text x={G.clientLabel[0]} y={G.clientLabel[1]} className="s-lab">
        {m.client}
      </text>
      <path d={G.conn.d} className="s-link" style={shown(!killed)} />
      <path d={G.conn.d} className="s-deadline" style={shown(killed)} />

      {/* la señal */}
      <path d={`M${G.signal[0][0]} ${G.signal[0][1]}L${G.signal[1][0]} ${G.signal[1][1]}`} className="s-link" />
      <Node cx={G.signal[0][0]} cy={G.signal[0][1]} r={4.5} />
      <text x={G.signalLabel[0]} y={G.signalLabel[1]} className={sig ? "s-hash" : "s-lab"}>
        {sig ? m.names[sig.kind] : m.inlet}
      </text>

      {/* el proceso: se apaga solo (TERM) o desaparece (KILL) */}
      <g style={shown(killed)}>
        <SelBox x={P.x} y={P.y} w={P.w} h={P.h} />
      </g>
      <g className={killed ? "quick" : undefined} style={{ opacity: f.proc === "exited" ? 0.4 : killed ? 0 : 1 }}>
        <Drawn pts={rectPts(P.x, P.y, P.w, P.h)} seed={601} />
        <text x={G.title[0]} y={G.title[1]} className="s-title">
          {m.app}
        </text>
        <text x={G.pidAt[0]} y={G.pidAt[1]} textAnchor="end" className="s-hash">
          {m.pid}
        </text>
      </g>
      <Chip {...Mm} kind="ink" text={m.memory(f.memory)} style={shown(!killed && f.proc !== "exited")} />
      <Chip {...Mm} kind="key" text={m.lost(f.memory)} style={shown(lost)} />
      <Chip {...G.status} kind="ink" text={m.chips.draining} style={shown(f.proc === "draining")} />
      <Chip {...G.status} kind="ink" text={m.chips.exited} style={shown(f.proc === "exited")} />
      <Chip {...G.status} kind="dead" text={m.chips.killed} style={shown(killed)} />

      {/* el disco y el lock */}
      <Drawn pts={sheetPts(D.x, D.y, D.w, D.h, 12)} seed={602} fold={12} />
      <text x={D.x + 14} y={D.y + 22} className="s-file">
        {m.disk}
      </text>
      <Chip {...G.diskChip} kind="safe" text={m.saved(f.saved)} style={shown(f.saved > 0)} />
      <g
        className={f.lock === "stale" ? "is-key" : undefined}
        style={{ opacity: f.lock === "removed" ? 0 : 1, transform: f.lock === "removed" ? tr(0, -8) : tr(0, 0) }}
      >
        <Drawn pts={sheetPts(L.x, L.y, L.w, L.h, 10)} seed={603} fold={10} />
        <text x={L.x + 14} y={L.y + 22} className="s-file">
          {m.lock}
        </text>
      </g>
      <Chip {...G.stale} kind="key" text={m.chips.stale} style={shown(f.stale)} />

      {/* en vuelo: pedidos, respuestas, lo que se guarda y la señal */}
      {dots &&
        f.dots.map((d) => {
          const [x, y] = where(d.on, d.p);
          const cls = d.kind === "res" ? "s-res" : d.kind === "save" ? "s-save" : "s-req";
          return <circle key={d.key} cx={x} cy={y} r={d.kind === "req" ? 5 : 5.5} className={cls} style={STILL} />;
        })}
      {f.flashes.map((x) => {
        const [px, py] = where(x.on, 0);
        return (
          <path
            key={x.key}
            d={xmark(px, py, 7)}
            className={x.bad ? "s-x-bad" : "s-x"}
            style={{ ...STILL, opacity: x.opacity }}
          />
        );
      })}
      {dots && f.signal !== null && (
        <circle
          cx={lerp(G.signal[0], G.signal[1], f.signal)[0]}
          cy={lerp(G.signal[0], G.signal[1], f.signal)[1]}
          r={5}
          className="s-req"
          style={STILL}
        />
      )}
    </svg>
  );
}

function result(f: KillFrame) {
  if (f.proc === "killed") return m.results.killed(f.cut, f.memory);
  if (f.proc === "draining") return m.results.draining;
  if (f.proc === "exited") return m.results.exited;
  return m.results.running;
}

/** Figura: el mismo programa atendiendo pedidos, y lo que le hace cada señal */
export function TermVsKill({ name, wide, label, caption }: FigureProps) {
  const [sig, setSig] = useState<SentSignal>(null);
  const { t, playing, reduced, clock, canvas, play, toggle, reset } = usePlayClock(TK_START);
  const f = simulateKill(sig, t);

  function send(kind: Signal) {
    if (sig) return;
    setSig({ kind, t: clock.current });
    if (!playing) play();
  }

  function again() {
    setSig(null);
    reset(TK_START);
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} sig={sig} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} sig={sig} f={f} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="presets" role="group" aria-label={m.signals}>
          {SIGNALS.map((k) => (
            <button key={k} type="button" disabled={sig !== null} aria-pressed={sig?.kind === k} onClick={() => send(k)}>
              {m.buttons[k]}
            </button>
          ))}
        </div>
        <div className="sim-controls">
          <button type="button" className="plain" aria-pressed={playing} onClick={toggle}>
            {playing ? `⏸ ${m.pause}` : `▶ ${m.play}`}
          </button>
          {sig && (
            <button type="button" className="plain" onClick={again}>
              {m.again}
            </button>
          )}
        </div>
        <div className="counter" aria-hidden="true">
          <span>
            {m.counters.served}
            <b>{f.served}</b>
          </span>
          <span>
            {m.counters.cut}
            <b className={f.cut > 0 ? "bad" : undefined}>{f.cut}</b>
          </span>
          <span>
            {m.counters.refused}
            <b>{f.refused}</b>
          </span>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

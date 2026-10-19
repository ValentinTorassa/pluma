"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, sheetPts, xmark, type Pt } from "./ink";
import { useTweenNumber } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.webhookRetry;

export type RetryMode = "naive" | "hardened";
const MODES: RetryMode[] = ["naive", "hardened"];

/* ---------- simulación ---------- */

/** Monto de la orden 1041 en el laboratorio */
export const AMOUNT = 25000;
/** Del proveedor al receptor, y la vuelta */
const TRAVEL = 1;
/** Del receptor a la base: la transacción que acredita (y anota, si corresponde) */
const DB = 0.5;
/** Cuánto espera el proveedor el 200 antes de dar la entrega por fallida */
const TIMEOUT = 3.2;
/** En qué parte del camino de vuelta se da por perdido el primer 200 */
const LOST_AT = 0.5;
/** Las dos entregas del mismo evento (tiempo comprimido: en el lab fueron 30 s) */
export const SEND = [0, TIMEOUT + 0.4] as const;
const arrive = (k: number) => SEND[k] + TRAVEL;
const applied = (k: number) => arrive(k) + DB;
const LOST_T = applied(0) + TRAVEL * LOST_AT;
const DELIVERED_T = applied(1) + TRAVEL;
/** Cuando ya pasó todo; el reloj se detiene ahí */
export const RT_END = DELIVERED_T + 0.5;
/** El cuadro inicial: la primera entrega en camino */
export const RT_START = 0.55;
/** Cuánto se ve la × del choque contra el id ya anotado */
const CONFLICT_SHOW = 1.4;

type Seg = "out" | "back" | "db";
export type RetryDot = { key: string; kind: "req" | "res" | "save"; seg: Seg; p: number };
export type RetryFrame = {
  dots: RetryDot[];
  /** Opacidad de la × del 200 perdido (0 = no se ve) */
  lost: number;
  /** Opacidad de la × del choque contra processed_events */
  conflict: number;
  provider: "waiting" | "timeout" | "delivered";
  /** Cuánto del timeout ya pasó (0 a 1) mientras el proveedor espera */
  ring: number | null;
  receiver: "idle" | "working" | "applied" | "duplicate";
  deliveries: number;
  credited: number;
  ledgerRows: number;
  processed: boolean;
  dupes: number;
  phase: "sending" | "applied" | "lost" | "retry" | "done";
};

/**
 * El mismo evento entregado dos veces: la primera respuesta 200 no llega a
 * tiempo y el proveedor reintenta. El receptor ingenuo acredita otra vez; el
 * que anota el id antes de aplicar lo descarta. Función pura del tiempo.
 */
export function simulateRetry(mode: RetryMode, t: number): RetryFrame {
  const hardened = mode === "hardened";
  const f: RetryFrame = {
    dots: [],
    lost: 0,
    conflict: 0,
    provider: "waiting",
    ring: null,
    receiver: "idle",
    deliveries: 0,
    credited: 0,
    ledgerRows: 0,
    processed: false,
    dupes: 0,
    phase: "sending",
  };

  SEND.forEach((s, k) => {
    const a = arrive(k);
    const d = applied(k);
    const key = `e${k}`;
    if (t >= s && t < a) f.dots.push({ key: `${key}-req`, kind: "req", seg: "out", p: (t - s) / TRAVEL });
    if (t >= a) f.deliveries++;
    if (t >= a && t < d) f.dots.push({ key: `${key}-save`, kind: "save", seg: "db", p: (t - a) / DB });
    if (t < d) return;
    const repeated = k > 0 && hardened;
    if (repeated) f.dupes++;
    else {
      f.credited += AMOUNT;
      f.ledgerRows++;
    }
    if (hardened) f.processed = true;
    // el 200 de vuelta: el primero se pierde en el camino, el segundo llega
    const end = k === 0 ? LOST_T : d + TRAVEL;
    if (t < end) f.dots.push({ key: `${key}-res`, kind: "res", seg: "back", p: (t - d) / TRAVEL });
  });

  if (t >= LOST_T && t < LOST_T + FLASH) f.lost = 1 - (t - LOST_T) / FLASH;
  if (hardened && t >= applied(1) && t < applied(1) + CONFLICT_SHOW) f.conflict = 1 - (t - applied(1)) / CONFLICT_SHOW;

  // el proveedor: espera el 200, se cansa, reintenta y recibe el segundo
  if (t >= DELIVERED_T) f.provider = "delivered";
  else if (t >= SEND[1]) {
    f.provider = "waiting";
    f.ring = (t - SEND[1]) / TIMEOUT;
  } else if (t >= SEND[0] + TIMEOUT) f.provider = "timeout";
  else f.ring = (t - SEND[0]) / TIMEOUT;

  const stage = (k: number) => (t >= applied(k) ? "done" : t >= arrive(k) ? "working" : null);
  const second = stage(1);
  const first = stage(0);
  if (second === "done") f.receiver = hardened ? "duplicate" : "applied";
  else if (second === "working" || first === "working") f.receiver = "working";
  else if (first === "done") f.receiver = "applied";

  if (t >= applied(1)) f.phase = "done";
  else if (t >= SEND[1]) f.phase = "retry";
  else if (t >= LOST_T) f.phase = "lost";
  else if (t >= applied(0)) f.phase = "applied";
  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  prov: Box;
  provTitle: Pt;
  provSub: Pt;
  provChip: Box;
  ring: Pt;
  recv: Box;
  recvTitle: Pt;
  recvMode: Pt;
  recvChip: Box;
  db: Box;
  dbTitle: Pt;
  order: Pt;
  amount: Pt;
  ledger: Pt;
  rows: [Pt, Pt];
  processed: Pt;
  processedRow: Pt;
  conflict: Pt;
  provEdge: Pt;
  recvIn: Pt;
  recvOut: Pt;
  dbEdge: Pt;
  lostLabel: Pt;
  lostAnchor: "middle" | "start";
  /** Dónde va el id del evento respecto del punto que viaja */
  tag: Pt;
  tagAnchor: "middle" | "start";
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 220,
  prov: { x: 0, y: 50, w: 164, h: 120 },
  provTitle: [14, 74],
  provSub: [14, 94],
  provChip: { x: 14, y: 132, w: 116, h: 24 },
  ring: [146, 144],
  recv: { x: 300, y: 50, w: 186, h: 120 },
  recvTitle: [314, 74],
  recvMode: [314, 94],
  recvChip: { x: 314, y: 132, w: 112, h: 24 },
  db: { x: 530, y: 0, w: 190, h: 220 },
  dbTitle: [544, 26],
  order: [544, 52],
  amount: [544, 86],
  ledger: [544, 114],
  rows: [
    [544, 134],
    [544, 152],
  ],
  processed: [544, 180],
  processedRow: [544, 200],
  conflict: [622, 196],
  provEdge: [164, 110],
  recvIn: [300, 110],
  recvOut: [486, 110],
  dbEdge: [530, 110],
  lostLabel: [232, 136],
  lostAnchor: "middle",
  tag: [0, -12],
  tagAnchor: "middle",
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 452,
  prov: { x: 0, y: 0, w: 380, h: 96 },
  provTitle: [14, 24],
  provSub: [14, 44],
  provChip: { x: 14, y: 58, w: 124, h: 24 },
  ring: [156, 70],
  recv: { x: 0, y: 166, w: 380, h: 96 },
  recvTitle: [14, 190],
  recvMode: [14, 210],
  recvChip: { x: 14, y: 224, w: 120, h: 24 },
  db: { x: 0, y: 322, w: 380, h: 130 },
  dbTitle: [14, 346],
  order: [14, 370],
  amount: [14, 406],
  ledger: [200, 346],
  rows: [
    [200, 366],
    [200, 384],
  ],
  processed: [200, 410],
  processedRow: [200, 430],
  conflict: [278, 426],
  provEdge: [190, 96],
  recvIn: [190, 166],
  recvOut: [190, 262],
  dbEdge: [190, 322],
  lostLabel: [204, 136],
  lostAnchor: "start",
  tag: [14, 4],
  tagAnchor: "start",
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });
/** Pesos con punto de miles, igual en el servidor y en el navegador */
export const pesos = (n: number) => `${n < 0 ? "−" : ""}$ ${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

function Chip({ box, kind, text, on }: { box: Box; kind: "ink" | "dead" | "safe" | "key"; text: string; on: boolean }) {
  return (
    <g style={shown(on)}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} className={`s-tag-${kind}`} />
      <text x={box.x + 9} y={box.y + box.h / 2 + 4} className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

function Ring({ at, p }: { at: Pt; p: number | null }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <g style={shown(p !== null)}>
      <circle cx={at[0]} cy={at[1]} r={r} className="wh-ring-track" />
      <circle
        cx={at[0]}
        cy={at[1]}
        r={r}
        className="wh-ring"
        transform={`rotate(-90 ${at[0]} ${at[1]})`}
        style={{ ...STILL, strokeDasharray: `${c} ${c}`, strokeDashoffset: c * (1 - Math.min(1, p ?? 0)) }}
      />
    </g>
  );
}

function Scene({ G, mode, f, credited, dots, label }: { G: Geo; mode: RetryMode; f: RetryFrame; credited: number; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { prov: P, recv: R, db: D } = G;
  const hardened = mode === "hardened";
  const over = credited > AMOUNT;
  const place = (seg: Seg, p: number): Pt =>
    seg === "out" ? lerp(G.provEdge, G.recvIn, p) : seg === "back" ? lerp(G.recvIn, G.provEdge, p) : lerp(G.recvOut, G.dbEdge, p);
  const lostAt = lerp(G.recvIn, G.provEdge, LOST_AT);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* cables */}
      <path d={`M${G.provEdge[0]} ${G.provEdge[1]}L${G.recvIn[0]} ${G.recvIn[1]}`} className="s-link" />
      <path d={`M${G.recvOut[0]} ${G.recvOut[1]}L${G.dbEdge[0]} ${G.dbEdge[1]}`} className="s-link" />
      <Node cx={G.recvIn[0]} cy={G.recvIn[1]} r={4.5} />
      <Node cx={G.dbEdge[0]} cy={G.dbEdge[1]} r={4.5} />

      {/* proveedor */}
      <Drawn pts={rectPts(P.x, P.y, P.w, P.h)} seed={901} />
      <text x={G.provTitle[0]} y={G.provTitle[1]} className="s-title">
        {m.provider}
      </text>
      <Glyph name="globe" x={P.x + P.w - 30} y={P.y + 11} />
      <text x={G.provSub[0]} y={G.provSub[1]} className="s-lab">
        {m.providerSub}
      </text>
      <Chip box={G.provChip} kind="ink" text={m.chips.waiting} on={f.provider === "waiting"} />
      <Chip box={G.provChip} kind="dead" text={m.chips.timeout} on={f.provider === "timeout"} />
      <Chip box={G.provChip} kind="safe" text={m.chips.delivered} on={f.provider === "delivered"} />
      <Ring at={G.ring} p={f.ring} />

      {/* receptor */}
      <Drawn pts={rectPts(R.x, R.y, R.w, R.h)} seed={902} />
      <text x={G.recvTitle[0]} y={G.recvTitle[1]} className="s-title">
        {m.receiver}
      </text>
      <Glyph name="server" x={R.x + R.w - 30} y={R.y + 11} />
      <text x={G.recvMode[0]} y={G.recvMode[1]} className="s-lab s-mono">
        {m.modes[mode]}
      </text>
      <Chip box={G.recvChip} kind="dead" text={m.chips.idle} on={f.receiver === "idle"} />
      <Chip box={G.recvChip} kind="ink" text={m.chips.working} on={f.receiver === "working"} />
      <Chip box={G.recvChip} kind={over ? "key" : "ink"} text={m.chips.applied} on={f.receiver === "applied"} />
      <Chip box={G.recvChip} kind="safe" text={m.chips.duplicate} on={f.receiver === "duplicate"} />

      {/* base de la tienda */}
      <Drawn pts={sheetPts(D.x, D.y, D.w, D.h, 12)} seed={903} fold={12} />
      <text x={G.dbTitle[0]} y={G.dbTitle[1]} className="s-title">
        {m.db}
      </text>
      <text x={G.order[0]} y={G.order[1]} className="s-hash">
        {m.order}
        <tspan className="s-lab">{`  ${m.credited}`}</tspan>
      </text>
      <text x={G.amount[0]} y={G.amount[1]} className={over ? "wh-amount bad" : "wh-amount"}>
        {pesos(credited)}
      </text>
      <text x={G.ledger[0]} y={G.ledger[1]} className="s-lab">
        {m.ledger}
      </text>
      {G.rows.map(([x, y], i) => (
        <text key={i} x={x} y={y} className={i > 0 ? "wh-row bad" : "wh-row"} style={shown(f.ledgerRows > i)}>
          {m.ledgerRow}
        </text>
      ))}
      <text x={G.processed[0]} y={G.processed[1]} className="s-lab s-mono">
        {m.processed}
      </text>
      <text x={G.processedRow[0]} y={G.processedRow[1]} className="s-lab" style={shown(!hardened)}>
        {m.notUsed}
      </text>
      <text x={G.processedRow[0]} y={G.processedRow[1]} className="wh-row safe" style={shown(hardened && f.processed)}>
        {m.event}
      </text>
      <g style={{ ...STILL, opacity: f.conflict }}>
        <path d={xmark(G.conflict[0], G.conflict[1] - 4, 5)} className="s-x" />
        <text x={G.conflict[0] + 10} y={G.conflict[1]} className="s-lab">
          {m.conflict}
        </text>
      </g>

      {/* el 200 que se perdió */}
      <g style={{ ...STILL, opacity: f.lost }}>
        <path d={xmark(lostAt[0], lostAt[1], 7)} className="s-x" />
      </g>
      <text
        x={G.lostLabel[0]}
        y={G.lostLabel[1]}
        textAnchor={G.lostAnchor}
        className="s-lab"
        style={shown(f.phase === "lost")}
      >
        {m.lost}
      </text>

      {dots &&
        f.dots.map((d) => {
          const [x, y] = place(d.seg, d.p);
          const cls = d.kind === "res" ? "s-res" : d.kind === "save" ? "s-save" : "s-req";
          return (
            <g key={d.key} style={STILL}>
              <circle cx={x} cy={y} r={d.kind === "req" ? 5 : 5.5} className={cls} style={STILL} />
              {d.kind === "req" && (
                <text x={x + G.tag[0]} y={y + G.tag[1]} textAnchor={G.tagAnchor} className="wh-row" style={STILL}>
                  {m.event}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

function result(mode: RetryMode, f: RetryFrame) {
  if (f.phase === "done") return m.results[mode];
  return m.results[f.phase];
}

/** Figura: el mismo pago entregado dos veces, con un receptor que acredita todo o uno que anota el id antes */
export function WebhookRetry({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<RetryMode>("naive");
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(RT_START);
  const seg = useRef<HTMLDivElement>(null);
  const time = Math.min(t, RT_END);
  const f = simulateRetry(mode, time);
  const credited = useTweenNumber(f.credited);
  const done = t >= RT_END;

  // al terminar el guion el reloj se detiene
  useEffect(() => {
    if (done && playing) toggle();
  }, [done, playing, toggle]);

  function pick(next: RetryMode) {
    if (next === mode) return;
    setMode(next);
    reset(RT_START);
    play();
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  function again() {
    reset(RT_START);
    play();
  }

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
        <Scene G={WIDE} mode={mode} f={f} credited={credited} dots={!reduced} label={label} />
        <Scene G={NARROW} mode={mode} f={f} credited={credited} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          {done ? (
            <button type="button" className="plain" onClick={again}>
              {`↺ ${m.again}`}
            </button>
          ) : (
            <button type="button" className="plain" aria-pressed={playing} onClick={toggle}>
              {playing ? `⏸ ${m.pause}` : `▶ ${m.play}`}
            </button>
          )}
        </div>
        <div className="counter" aria-hidden="true">
          <span>
            {m.counters.deliveries}
            <b>{f.deliveries}</b>
          </span>
          <span>
            {m.counters.credited}
            <b className={f.credited > AMOUNT ? "bad" : undefined}>{pesos(credited)}</b>
          </span>
          <span>
            {m.counters.dupes}
            <b>{f.dupes}</b>
          </span>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(mode, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

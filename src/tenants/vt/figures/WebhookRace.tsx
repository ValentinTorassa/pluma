"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, sheetPts, type Pt } from "./ink";
import { useTweenNumber } from "./motion";
import { Drawn, FigureFrame, Marks, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";
import { pesos } from "./WebhookRetry";

const m = copy.figures.webhookRace;

export type RaceMode = "check" | "unique";
const MODES: RaceMode[] = ["check", "unique"];

/** Monto de la orden 1042 en el laboratorio */
const AMOUNT = 18500;
export const RACE_STEPS = 4;
const SLOTS = 7;

type ChipKind = "plain" | "wait" | "bad" | "safe";
/** Una operación de un worker: en qué carril, desde qué casillero, cuántos ocupa y en qué paso aparece */
export type Op = {
  lane: 0 | 1;
  slot: number;
  span?: number;
  text: keyof typeof m.chips;
  step: number;
  kind?: ChipKind;
  tag?: keyof typeof m.tags;
  tagKind?: "bad" | "safe" | "plain";
};

/**
 * Lo que hace cada worker con su entrega de evt_0002, tal como corre en el
 * laboratorio: en `check` busca, acredita y recién después anota con
 * INSERT OR IGNORE; en `unique` abre BEGIN IMMEDIATE, anota primero y el
 * segundo choca contra la clave primaria.
 */
export const OPS: Record<RaceMode, Op[]> = {
  check: [
    { lane: 0, slot: 0, text: "select", step: 1, tag: "unseen" },
    { lane: 1, slot: 0, text: "select", step: 1, tag: "unseen" },
    { lane: 0, slot: 1, text: "credit", step: 2 },
    { lane: 1, slot: 1, text: "credit", step: 2, kind: "bad" },
    { lane: 0, slot: 2, text: "insert", step: 3 },
    { lane: 1, slot: 2, text: "insert", step: 3, tag: "ignored" },
    { lane: 0, slot: 3, text: "ok", step: 3 },
    { lane: 1, slot: 3, text: "ok", step: 3, kind: "bad" },
  ],
  unique: [
    { lane: 0, slot: 0, text: "begin", step: 1 },
    { lane: 0, slot: 1, text: "insert", step: 1, tag: "oneRow", tagKind: "safe" },
    { lane: 1, slot: 0, span: 4, text: "wait", step: 1, kind: "wait" },
    { lane: 0, slot: 2, text: "credit", step: 2 },
    { lane: 0, slot: 3, text: "commit", step: 2 },
    { lane: 0, slot: 4, text: "ok", step: 3 },
    { lane: 1, slot: 4, text: "insert", step: 3, tag: "conflict", tagKind: "bad" },
    { lane: 1, slot: 5, text: "rollback", step: 3 },
    { lane: 1, slot: 6, text: "dup", step: 3, kind: "safe" },
  ],
};

/** Qué muestra la figura en el paso `step` (0 = llegan las dos entregas) */
export function raceAt(mode: RaceMode, step: number) {
  const ops = OPS[mode].filter((o) => o.step <= step);
  const credits = ops.filter((o) => o.text === "credit").length;
  const end = ops.reduce((n, o) => Math.max(n, o.slot + (o.span ?? 1)), 0);
  return {
    ops,
    credited: credits * AMOUNT,
    rows: credits,
    /** Hasta qué casillero llegó el tiempo */
    end,
    /** La ventana entre leer y anotar, solo en `check` y desde que las dos leyeron */
    window: mode === "check" && step >= 1,
  };
}

/* ---------- dibujo ---------- */

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  /** Rectángulo de un casillero de un carril */
  cell: (lane: 0 | 1, slot: number, span: number) => { x: number; y: number; w: number; h: number };
  /** Dónde va la etiqueta de un chip, y con qué alineación */
  tagAt: (c: { x: number; y: number; w: number; h: number }) => { x: number; y: number; anchor: "start" | "end" };
  laneLabels: [Pt, Pt];
  evtTags: [Pt, Pt];
  axis: [Pt, Pt];
  axisLabel: Pt;
  /** Línea del tiempo actual, en el casillero `end` */
  cursor: (end: number) => [Pt, Pt];
  window: { x: number; y: number; w: number; h: number };
  windowLabel: Pt | null;
  sheet: { x: number; y: number; w: number; h: number };
  order: Pt;
  amount: Pt;
  rows: [Pt, Pt];
};

const WX = 80;
const SW = 68;
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 210,
  cell: (lane, slot, span) => ({ x: WX + slot * SW + 3, y: lane ? 122 : 50, w: span * SW - 6, h: 28 }),
  tagAt: (c) => ({ x: c.x + 2, y: c.y + c.h + 15, anchor: "start" }),
  laneLabels: [
    [0, 62],
    [0, 134],
  ],
  evtTags: [
    [0, 80],
    [0, 152],
  ],
  axis: [
    [WX, 22],
    [WX + SLOTS * SW, 22],
  ],
  axisLabel: [WX + SLOTS * SW - 2, 14],
  cursor: (end) => [
    [WX + end * SW, 30],
    [WX + end * SW, 172],
  ],
  window: { x: WX, y: 38, w: 2 * SW, h: 134 },
  windowLabel: [WX, 194],
  sheet: { x: 572, y: 30, w: 148, h: 150 },
  order: [586, 54],
  amount: [586, 102],
  rows: [
    [586, 124],
    [586, 144],
  ],
};

const NY = 66;
const SH = 34;
const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 438,
  cell: (lane, slot, span) => ({ x: lane ? 216 : 48, y: NY + slot * SH + 3, w: 148, h: span * SH - 6 }),
  tagAt: (c) => ({ x: c.x + c.w - 8, y: c.y + 18, anchor: "end" }),
  laneLabels: [
    [48, 22],
    [216, 22],
  ],
  evtTags: [
    [48, 42],
    [216, 42],
  ],
  axis: [
    [20, NY],
    [20, NY + SLOTS * SH],
  ],
  axisLabel: [0, NY - 8],
  cursor: (end) => [
    [28, NY + end * SH],
    [372, NY + end * SH],
  ],
  window: { x: 40, y: NY, w: 332, h: 2 * SH },
  windowLabel: null,
  sheet: { x: 0, y: 326, w: 380, h: 112 },
  order: [14, 348],
  amount: [14, 404],
  rows: [
    [200, 362],
    [200, 384],
  ],
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Chip({ op, G, on, delay }: { op: Op; G: Geo; on: boolean; delay: number }) {
  const c = G.cell(op.lane, op.slot, op.span ?? 1);
  const tag = op.tag ? G.tagAt(c) : null;
  const kind = op.kind ?? "plain";
  // el texto va centrado en el chip; en el angosto, a la izquierda para dejarle lugar a la etiqueta
  const tx = G.narrow ? c.x + 10 : c.x + c.w / 2;
  return (
    <g className={on ? "mk on" : "mk"} style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}>
      <g className={`wh-chip ${kind}`}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={5} />
        <text x={tx} y={c.y + (G.narrow ? 18 : c.h / 2 + 4)} textAnchor={G.narrow ? "start" : "middle"}>
          {m.chips[op.text]}
        </text>
      </g>
      {tag && op.tag && (
        <text x={tag.x} y={tag.y} textAnchor={tag.anchor} className={`wh-tag ${op.tagKind ?? "plain"}`}>
          {m.tags[op.tag]}
        </text>
      )}
    </g>
  );
}

function Scene({ G, mode, step, credited, label }: { G: Geo; mode: RaceMode; step: number; credited: number; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const now = raceAt(mode, step);
  const S = G.sheet;
  const [c0, c1] = G.cursor(now.end);
  const [c0start] = G.cursor(0);
  const over = credited > AMOUNT;
  // los chips que aparecen en este paso entran de a uno
  const firstSlot = Math.min(...OPS[mode].filter((o) => o.step === step).map((o) => o.slot), Infinity);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* la ventana: las dos leyeron y ninguna anotó */}
      <rect x={G.window.x} y={G.window.y} width={G.window.w} height={G.window.h} rx={6} className="wh-window" style={shown(now.window)} />
      {G.windowLabel && (
        <text x={G.windowLabel[0]} y={G.windowLabel[1]} className="wh-tag bad" style={shown(now.window)}>
          {m.window}
        </text>
      )}

      {/* eje del tiempo */}
      <path d={`M${G.axis[0][0]} ${G.axis[0][1]}L${G.axis[1][0]} ${G.axis[1][1]}`} className="s-guide" />
      <text x={G.axisLabel[0]} y={G.axisLabel[1]} textAnchor={G.narrow ? "start" : "end"} className="s-lab">
        {G.narrow ? `${m.time} ↓` : `${m.time} →`}
      </text>

      {G.laneLabels.map(([x, y], i) => (
        <text key={i} x={x} y={y} className="s-title">
          {m.lanes[i]}
        </text>
      ))}
      {G.evtTags.map(([x, y], i) => (
        <text key={i} x={x} y={y} className="wh-row">
          {m.event}
        </text>
      ))}

      {OPS[mode].map((op, i) => (
        <Chip key={`${mode}-${i}`} op={op} G={G} on={op.step <= step} delay={op.step === step ? (op.slot - firstSlot) * 140 : 0} />
      ))}

      {/* hasta dónde llegó el tiempo */}
      <g style={{ transform: G.narrow ? `translateY(${c0[1] - c0start[1]}px)` : tr(c0[0] - c0start[0], 0) }}>
        <path d={`M${c0start[0]} ${c0start[1]}L${G.narrow ? c1[0] : c0start[0]} ${G.narrow ? c0start[1] : c1[1]}`} className="wh-cursor" />
      </g>

      {/* la orden */}
      <Drawn pts={sheetPts(S.x, S.y, S.w, S.h, 12)} seed={921} fold={12} />
      <text x={G.order[0]} y={G.order[1]} className="s-hash">
        {m.order}
      </text>
      <text x={G.order[0]} y={G.order[1] + 18} className="s-lab">
        {m.credited}
      </text>
      <text x={G.amount[0]} y={G.amount[1]} className={over ? "wh-amount bad" : "wh-amount"}>
        {pesos(credited)}
      </text>
      {G.rows.map(([x, y], i) => (
        <text key={i} x={x} y={y} className={i > 0 ? "wh-row bad" : "wh-row"} style={shown(now.rows > i)}>
          {m.ledgerRow(i === 0 ? "A" : "B")}
        </text>
      ))}
    </svg>
  );
}

/** Figura: dos entregas del mismo evento en paralelo, con el receptor que busca y después anota o el que anota primero */
export function WebhookRace({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<RaceMode>("check");
  const [step, setStep] = useState(0);
  const seg = useRef<HTMLDivElement>(null);
  const credited = useTweenNumber(raceAt(mode, step).credited);

  function pick(next: RaceMode) {
    if (next === mode) return;
    setMode(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
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
      <div className="fig-canvas">
        <Scene G={WIDE} mode={mode} step={step} credited={credited} label={label} />
        <Scene G={NARROW} mode={mode} step={step} credited={credited} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <Stepper count={RACE_STEPS} index={step} label={rich(m.steps[mode][step])} onChange={setStep} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

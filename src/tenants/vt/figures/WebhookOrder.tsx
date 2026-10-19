"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { useTweenNumber } from "./motion";
import { Drawn, FigureFrame, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";
import { pesos } from "./WebhookRetry";

const m = copy.figures.webhookOrder;

export type OrderMode = "last" | "table";
const MODES: OrderMode[] = ["last", "table"];
export type State = "created" | "paid" | "refunded";
const STATES: State[] = ["created", "paid", "refunded"];

/** Monto de la orden 1045 en el laboratorio */
export const AMOUNT = 12750;
export const ORDER_STEPS = 3;

/** Lo que el lector ve en el paso `step`: estado, monto y qué pasó con cada entrega */
export type OrderFrame = {
  state: State;
  credited: number;
  /** Código que contestó el receptor a cada una de las tres entregas (null = todavía no llegó) */
  codes: [number | null, number | null, number | null];
  /** El salto que no debería existir: created → refunded */
  skip: "none" | "taken" | "blocked";
  /** La vuelta atrás de refunded a paid (solo si gana el último) */
  back: boolean;
  /** Qué arista de la tabla se usó en este paso */
  edge: "approved" | "refunded" | null;
  deadLetter: boolean;
  /** Al final, si la base coincide con el proveedor */
  match: boolean | null;
};

/**
 * La orden 1045 con el reembolso adelantado, como en el laboratorio: llega
 * evt_0005 (refunded), cinco segundos después evt_0004 (approved) y, si el
 * receptor contestó 409, el proveedor reintenta evt_0005 a los sesenta.
 */
export function orderAt(mode: OrderMode, step: number): OrderFrame {
  if (mode === "last") {
    return {
      state: step === 0 ? "refunded" : "paid",
      credited: step === 0 ? -AMOUNT : 0,
      codes: [200, step >= 1 ? 200 : null, null],
      skip: "taken",
      back: step >= 1,
      edge: null,
      deadLetter: false,
      match: step >= 2 ? false : null,
    };
  }
  return {
    state: step === 0 ? "created" : step === 1 ? "paid" : "refunded",
    credited: step === 1 ? AMOUNT : 0,
    codes: [409, step >= 1 ? 200 : null, step >= 2 ? 200 : null],
    skip: "blocked",
    back: false,
    edge: step === 1 ? "approved" : step === 2 ? "refunded" : null,
    deadLetter: true,
    match: step >= 2 ? true : null,
  };
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  nodes: Record<State, Box>;
  /** created → paid y paid → refunded */
  edges: { approved: [Pt, Pt]; refunded: [Pt, Pt] };
  edgeLabels: { approved: Pt; refunded: Pt };
  edgeAnchor: "middle" | "start";
  skip: Cubic;
  skipLabel: Pt | null;
  back: Cubic;
  chips: [Box, Box, Box];
  sheet: Box;
  provider: Box;
  dead: Box;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 300,
  nodes: {
    created: { x: 20, y: 44, w: 140, h: 46 },
    paid: { x: 290, y: 44, w: 140, h: 46 },
    refunded: { x: 560, y: 44, w: 140, h: 46 },
  },
  edges: {
    approved: [
      [160, 67],
      [290, 67],
    ],
    refunded: [
      [430, 67],
      [560, 67],
    ],
  },
  edgeLabels: { approved: [225, 59], refunded: [495, 59] },
  edgeAnchor: "middle",
  skip: cubic([90, 44], [90, 2], [630, 2], [630, 44]),
  skipLabel: [360, 30],
  back: cubic([630, 90], [630, 128], [360, 128], [360, 90]),
  chips: [
    { x: 20, y: 140, w: 150, h: 42 },
    { x: 184, y: 140, w: 150, h: 42 },
    { x: 348, y: 140, w: 150, h: 42 },
  ],
  sheet: { x: 20, y: 204, w: 220, h: 92 },
  provider: { x: 258, y: 204, w: 230, h: 92 },
  dead: { x: 502, y: 140, w: 198, h: 156 },
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 470,
  nodes: {
    created: { x: 40, y: 20, w: 150, h: 42 },
    paid: { x: 40, y: 122, w: 150, h: 42 },
    refunded: { x: 40, y: 224, w: 150, h: 42 },
  },
  edges: {
    approved: [
      [115, 62],
      [115, 122],
    ],
    refunded: [
      [115, 164],
      [115, 224],
    ],
  },
  edgeLabels: { approved: [124, 96], refunded: [124, 198] },
  edgeAnchor: "start",
  skip: cubic([40, 41], [6, 41], [6, 245], [40, 245]),
  skipLabel: null,
  back: cubic([190, 245], [226, 245], [226, 143], [190, 143]),
  chips: [
    { x: 236, y: 20, w: 144, h: 42 },
    { x: 236, y: 76, w: 144, h: 42 },
    { x: 236, y: 132, w: 144, h: 42 },
  ],
  sheet: { x: 0, y: 290, w: 182, h: 92 },
  provider: { x: 198, y: 290, w: 182, h: 92 },
  dead: { x: 0, y: 396, w: 380, h: 74 },
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

/** Punta de flecha en `to`, mirando desde `from` */
function head(from: Pt, to: Pt, s = 7): string {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const p = (d: number): Pt => [to[0] - s * Math.cos(a + d), to[1] - s * Math.sin(a + d)];
  const [l, r] = [p(0.45), p(-0.45)];
  return `M${l[0].toFixed(1)} ${l[1].toFixed(1)}L${to[0]} ${to[1]}L${r[0].toFixed(1)} ${r[1].toFixed(1)}`;
}

/** Una curva que se dibuja de punta a punta cuando `on` */
function Stroke({ c, on, className }: { c: Cubic; on: boolean; className: string }) {
  return (
    <path
      d={c.d}
      className={className}
      style={{ strokeDasharray: `${c.dash} ${c.dash}`, strokeDashoffset: on ? 0 : c.dash }}
    />
  );
}

function Scene({ G, mode, step, credited, label }: { G: Geo; mode: OrderMode; step: number; credited: number; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const f = orderAt(mode, step);
  const skipMid = G.skip.at(G.skip.length / 2);
  const skipEnd = G.skip.at(G.skip.length);
  const skipPre = G.skip.at(G.skip.length - 8);
  const backEnd = G.back.at(G.back.length);
  const backPre = G.back.at(G.back.length - 8);
  const S = G.sheet;
  const P = G.provider;
  const D = G.dead;
  const visibleChips = mode === "table" ? 3 : 2;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el salto created → refunded: lo toma quien deja ganar al último, la tabla lo frena */}
      <path d={G.skip.d} className="s-deadline" style={shown(f.skip === "blocked")} />
      <Stroke c={G.skip} on={f.skip === "taken"} className="s-live" />
      <path d={head(skipPre, skipEnd)} className="s-live" style={shown(f.skip === "taken")} />
      <path d={xmark(skipMid[0], skipMid[1], 6)} className="s-x-bad" style={shown(f.skip === "blocked")} />
      {G.skipLabel && (
        <text x={G.skipLabel[0]} y={G.skipLabel[1]} textAnchor="middle" className="wh-tag bad" style={shown(f.skip === "blocked")}>
          {m.notInTable}
        </text>
      )}

      {/* la vuelta atrás: refunded → paid */}
      <Stroke c={G.back} on={f.back} className="s-live" />
      <path d={head(backPre, backEnd)} className="s-live" style={shown(f.back)} />

      {/* la tabla: las dos transiciones que existen */}
      {(["approved", "refunded"] as const).map((k) => {
        const [a, b] = G.edges[k];
        const on = f.edge === k;
        return (
          <g key={k}>
            <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} className={on ? "wh-edge on" : "wh-edge"} />
            <path d={head(a, b)} className={on ? "wh-edge on" : "wh-edge"} />
            <text x={G.edgeLabels[k][0]} y={G.edgeLabels[k][1]} textAnchor={G.edgeAnchor} className={on ? "wh-row" : "wh-tag plain"}>
              {k === "approved" ? m.approved : m.refunded}
            </text>
          </g>
        );
      })}

      {STATES.map((s, i) => {
        const b = G.nodes[s];
        const cur = f.state === s;
        return (
          <g key={s} className={cur ? "wh-state cur" : "wh-state"}>
            <Drawn pts={rectPts(b.x, b.y, b.w, b.h)} seed={931 + i} />
            <rect x={b.x + 4} y={b.y + 4} width={b.w - 8} height={b.h - 8} rx={4} className="wh-state-fill" />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle" className="wh-state-text">
              {m.states[s]}
            </text>
          </g>
        );
      })}

      {/* las entregas, en el orden en que llegan */}
      {G.chips.map((c, i) => {
        const e = m.events[i];
        const code = f.codes[i];
        const bad = code !== null && code >= 300;
        return (
          <g key={i} className={i < visibleChips ? "mk on" : "mk"}>
            <g className={`wh-chip ${code === null ? "wait" : bad ? "bad" : "plain"}`}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={5} />
              <text x={c.x + 10} y={c.y + 17}>
                {e.id}
                <tspan className="wh-when">{`  ${e.when}`}</tspan>
              </text>
              <text x={c.x + 10} y={c.y + 33} className="wh-sub">
                {e.type}
              </text>
            </g>
            <text x={c.x + c.w - 10} y={c.y + 17} textAnchor="end" className={`wh-code ${bad ? "bad" : ""}`} style={shown(code !== null)}>
              {code ?? ""}
            </text>
          </g>
        );
      })}

      {/* la orden en tu base */}
      <Drawn pts={sheetPts(S.x, S.y, S.w, S.h, 10)} seed={941} fold={10} />
      <text x={S.x + 14} y={S.y + 22} className="s-hash">
        {m.order}
        <tspan className="s-lab">{`  ${m.credited}`}</tspan>
      </text>
      <text x={S.x + 14} y={S.y + 56} className={credited < 0 ? "wh-amount bad" : "wh-amount"}>
        {pesos(credited)}
      </text>
      <text x={S.x + 14} y={S.y + 78} className="s-lab s-mono">
        {m.stateLabel(f.state)}
      </text>

      {/* lo que dice el proveedor */}
      <Drawn pts={rectPts(P.x, P.y, P.w, P.h)} seed={942} />
      <text x={P.x + 14} y={P.y + 22} className="s-lab">
        {m.provider}
      </text>
      <text x={P.x + 14} y={P.y + 48} className="s-hash">
        {m.providerState}
      </text>
      <text x={P.x + 14} y={P.y + 74} className="wh-tag safe" style={shown(f.match === true)}>
        {`✓ ${m.match}`}
      </text>
      <text x={P.x + 14} y={P.y + 74} className="wh-tag bad" style={shown(f.match === false)}>
        {`✗ ${m.mismatch}`}
      </text>

      {/* dead-letter */}
      <rect x={D.x} y={D.y} width={D.w} height={D.h} rx={6} className="wh-dead" />
      <text x={D.x + 12} y={D.y + 20} className="s-lab s-mono">
        {m.deadLetter}
      </text>
      <text x={D.x + 12} y={D.y + 42} className="s-lab" style={shown(mode === "last")}>
        {m.deadUnused}
      </text>
      <g className={f.deadLetter ? "mk on" : "mk"}>
        <text x={D.x + 12} y={D.y + 42} className="wh-row bad">
          {m.deadRow.split(" · ")[0]}
        </text>
        <text x={D.x + 12} y={D.y + 60} className="wh-row">
          {m.deadRow.split(" · ")[1]}
        </text>
      </g>
    </svg>
  );
}

/** Figura: el reembolso llega antes que la aprobación; gana el último o deciden las transiciones escritas */
export function WebhookOrder({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<OrderMode>("last");
  const [step, setStep] = useState(0);
  const seg = useRef<HTMLDivElement>(null);
  const credited = useTweenNumber(orderAt(mode, step).credited);

  function pick(next: OrderMode) {
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
        <Stepper count={ORDER_STEPS} index={step} label={rich(m.steps[mode][step])} onChange={setStep} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

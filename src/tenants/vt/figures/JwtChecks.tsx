"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { frame, GLYPHS, rectPts, xmark, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.jwtChecks;

export type CheckId = "alg" | "sig" | "exp" | "aud";
/** En el orden en que los mira jose: el alg antes que la firma, la firma antes que los claims */
export const CHECKS: CheckId[] = ["alg", "sig", "exp", "aud"];
export type Enabled = Record<CheckId, boolean>;
export const ALL_ON: Enabled = { alg: true, sig: true, exp: true, aud: true };

export type TokenId = keyof typeof m.tokens;
/** Los seis tokens de la demo y el control que frena a cada uno (null: ninguno, es el correcto) */
export const TOKENS: { id: TokenId; stop: CheckId | null }[] = [
  { id: "ok", stop: null },
  { id: "role", stop: "sig" },
  { id: "expired", stop: "exp" },
  { id: "aud", stop: "aud" },
  { id: "none", stop: "alg" },
  { id: "noexp", stop: "exp" },
];

/* ---------- simulación ---------- */

/** Dónde está cada control sobre el recorrido (0 = sale de la fila, 1 = llega al handler) */
export const GATE_P: Record<CheckId, number> = { alg: 0.16, sig: 0.38, exp: 0.6, aud: 0.82 };
/** Un token frenado se queda justo antes del control */
const STOP_GAP = 0.07;
/** De la fila al recorrido, y el recorrido entero */
const ENTRY = 0.3;
const TRACK = 1.3;
/** Después de un rechazo: cuánto se ve el código, y cuándo sale el siguiente */
const CODE_SHOW = 1.15;
const HOLD = 1.25;
const NEXT_AFTER_ARRIVE = 0.35;
/** El token frenado se queda quieto y después se va */
const PARK = 0.75;
const FADE = 0.3;
const FIRST = 0.15;

export type Outcome = "arrived" | "caught" | "entered";
export type Planned = { id: TokenId; stop: CheckId | null; start: number; end: number; pEnd: number; outcome: Outcome };

/** Cuándo sale y cuándo termina cada token, con los controles `on` */
export function schedule(on: Enabled): Planned[] {
  let s = FIRST;
  return TOKENS.map((tk) => {
    const caught = tk.stop !== null && on[tk.stop];
    const pEnd = caught && tk.stop ? GATE_P[tk.stop] - STOP_GAP : 1;
    const end = s + ENTRY + pEnd * TRACK;
    const outcome: Outcome = tk.stop === null ? "arrived" : caught ? "caught" : "entered";
    const item = { ...tk, start: s, end, pEnd, outcome };
    s = end + (caught ? HOLD : NEXT_AFTER_ARRIVE);
    return item;
  });
}

/** Cuando ya pasaron los seis y se fue el último código; el reloj se detiene ahí */
export function checksEnd(on: Enabled): number {
  const last = schedule(on)[TOKENS.length - 1];
  return last.end + (last.outcome === "caught" ? Math.max(CODE_SHOW, PARK + FADE) + 0.15 : 0.8);
}
/** El cuadro inicial: el correcto ya llegó y la firma acaba de frenar al de rol cambiado */
export const CK_START = schedule(ALL_ON)[1].end + 0.35;

export type QueueState = "waiting" | "active" | Outcome;
export type ChecksFrame = {
  queue: QueueState[];
  /** El token en camino (o quieto frente al control que lo frenó) */
  moving: { index: number; leg: "entry" | "track"; p: number; opacity: number; breached: boolean } | null;
  /** El control que acaba de frenar un token, su × y el código de error */
  code: { index: number; check: CheckId; opacity: number } | null;
  /** Lo que llegó al handler, en orden de llegada */
  arrived: { index: number; intrusion: boolean; opacity: number }[];
  stopped: number;
  /** El último token que terminó su recorrido */
  last: { index: number; outcome: Outcome } | null;
  done: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Los seis tokens pasan de a uno por los controles. Un control prendido frena
 * al token que le toca; apagado, ese token llega al handler. Función pura del
 * tiempo y de los controles prendidos.
 */
export function simulateChecks(on: Enabled, t: number): ChecksFrame {
  const plan = schedule(on);
  const f: ChecksFrame = { queue: [], moving: null, code: null, arrived: [], stopped: 0, last: null, done: t >= checksEnd(on) };

  plan.forEach((tk, index) => {
    if (t < tk.start) {
      f.queue.push("waiting");
      return;
    }
    if (t < tk.end) {
      f.queue.push("active");
      const entry = t < tk.start + ENTRY;
      const p = entry ? (t - tk.start) / ENTRY : (t - tk.start - ENTRY) / TRACK;
      const breached = !entry && tk.outcome === "entered" && tk.stop !== null && p >= GATE_P[tk.stop];
      f.moving = { index, leg: entry ? "entry" : "track", p, opacity: 1, breached };
      return;
    }
    f.queue.push(tk.outcome);
    f.last = { index, outcome: tk.outcome };
    if (tk.outcome === "caught" && tk.stop) {
      f.stopped++;
      const since = t - tk.end;
      if (since < PARK + FADE) f.moving = { index, leg: "track", p: tk.pEnd, opacity: 1 - clamp01((since - PARK) / FADE), breached: false };
      if (since < CODE_SHOW) f.code = { index, check: tk.stop, opacity: clamp01((CODE_SHOW - since) / FADE) };
    } else {
      f.arrived.push({ index, intrusion: tk.outcome === "entered", opacity: clamp01((t - tk.end) / FADE) });
    }
  });
  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  chip: (i: number) => Box;
  /** De dónde sale el token hacia el recorrido (null: aparece en la punta del recorrido) */
  entry: ((i: number) => Pt) | null;
  track: [Pt, Pt];
  /** La barrera de un control, centrada en `at` */
  gate: (at: Pt) => Box;
  /** Nombre del control, y el renglón de abajo (apagado o el código) */
  gateName: (at: Pt, k: CheckId) => { x: number; y: number; anchor: "middle" | "start"; lines: readonly string[] };
  gateSub: (at: Pt, k: CheckId) => { x: number; y: number; anchor: "middle" | "start" | "end" };
  code: (at: Pt, k: CheckId) => { x: number; y: number; anchor: "start" | "middle" | "end" };
  handler: Box;
  row: (j: number) => { x: number; y: number; w: number };
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 196,
  chip: (i) => ({ x: 0, y: 8 + i * 31, w: 182, h: 24 }),
  entry: (i) => [182, 20 + i * 31],
  track: [
    [196, 98],
    [572, 98],
  ],
  gate: ([x, y]) => ({ x: x - 4, y: y - 34, w: 8, h: 68 }),
  gateName: ([x], k) => ({ x, y: 40, anchor: "middle", lines: k === "aud" ? m.audLines : [m.names[k]] }),
  gateSub: ([x]) => ({ x, y: 56, anchor: "middle" }),
  // el código más largo (el de la firma) va centrado; los demás no se pasan del recorrido
  code: ([x, y], k) =>
    k === "sig" ? { x, y: y + 58, anchor: "middle" } : k === "alg" ? { x: x - 6, y: y + 58, anchor: "start" } : { x: x + 6, y: y + 58, anchor: "end" },
  handler: { x: 572, y: 8, w: 148, h: 180 },
  row: (j) => ({ x: 586, y: 76 + j * 20, w: 124 }),
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 470,
  chip: (i) => ({ x: (i % 2) * 196, y: Math.floor(i / 2) * 32, w: 184, h: 26 }),
  entry: null,
  track: [
    [40, 112],
    [40, 360],
  ],
  gate: ([x, y]) => ({ x: x - 28, y: y - 4, w: 56, h: 8 }),
  gateName: ([, y], k) => ({ x: 86, y: y - 1, anchor: "start", lines: [m.names[k]] }),
  gateSub: ([, y]) => ({ x: 86, y: y + 15, anchor: "start" }),
  code: ([, y]) => ({ x: 86, y: y + 15, anchor: "start" }),
  handler: { x: 0, y: 360, w: 380, h: 110 },
  row: (j) => ({ x: 14 + (j % 2) * 186, y: 412 + Math.floor(j / 2) * 22, w: 170 }),
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });
const SEEDS: Record<CheckId, number> = { alg: 1201, sig: 1202, exp: 1203, aud: 1204 };

/** El token en miniatura: header, payload y firma; el de alg none no trae firma */
function MiniToken({ at, id, breached, opacity }: { at: Pt; id: TokenId; breached: boolean; opacity: number }) {
  const [x, y] = at;
  return (
    <g style={{ ...STILL, opacity }} className={breached ? "jc-tok breached" : "jc-tok"}>
      <rect x={x - 15} y={y - 7} width={30} height={14} rx={3} className="jc-tok-bg" style={STILL} />
      <rect x={x - 11} y={y - 3} width={6} height={6} className="jc-h" style={STILL} />
      <rect x={x - 3} y={y - 3} width={6} height={6} className={id === "role" ? "jc-pc" : "jc-p"} style={STILL} />
      <rect x={x + 5} y={y - 3} width={6} height={6} className={id === "none" ? "jc-none" : "jc-s"} style={STILL} />
    </g>
  );
}

function Scene({ G, on, f, dots, label }: { G: Geo; on: Enabled; f: ChecksFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const [a, b] = G.track;
  const gateAt = (k: CheckId) => lerp(a, b, GATE_P[k]);
  const H = G.handler;
  const moving = f.moving;
  const tokenAt = (): Pt | null => {
    if (!moving) return null;
    if (moving.leg === "track") return lerp(a, b, moving.p);
    return G.entry ? lerp(G.entry(moving.index), a, moving.p) : a;
  };
  const at = tokenAt();
  // sin pata de entrada (angosta), el token aparece en la punta del recorrido
  const enterOpacity = moving && moving.leg === "entry" && !G.entry ? moving.p : 1;
  const code = f.code && {
    gate: gateAt(f.code.check),
    at: G.code(gateAt(f.code.check), f.code.check),
    text: m.codes[TOKENS[f.code.index].id as Exclude<TokenId, "ok">],
    opacity: f.code.opacity,
  };

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el recorrido, de la fila al handler */}
      <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} className="s-guide" />
      <Node cx={a[0]} cy={a[1]} r={4} />
      <Node cx={b[0]} cy={b[1]} r={4.5} />

      {/* la fila de tokens */}
      {TOKENS.map((tk, i) => {
        const c = G.chip(i);
        const state = f.queue[i];
        return (
          <g key={tk.id} className={`jc-chip ${state}`}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={5} />
            <text x={c.x + 10} y={c.y + c.h / 2 + 4}>
              {m.tokens[tk.id]}
            </text>
            <path d={xmark(c.x + c.w - 13, c.y + c.h / 2, 4)} className="s-x" style={shown(state === "caught")} />
            <path
              d={GLYPHS.check[0].d}
              transform={`translate(${c.x + c.w - 20} ${c.y + c.h / 2 - 7}) scale(0.85)`}
              className="jw-mark-ok"
              style={shown(state === "arrived")}
            />
          </g>
        );
      })}

      {/* los controles */}
      {CHECKS.map((k) => {
        const at = gateAt(k);
        const g = G.gate(at);
        const name = G.gateName(at, k);
        const sub = G.gateSub(at, k);
        return (
          <g key={k}>
            <g style={shown(on[k])}>
              <Drawn pts={rectPts(g.x, g.y, g.w, g.h)} seed={SEEDS[k]} />
            </g>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={2} className="sd-ghost" style={shown(!on[k])} />
            <text x={name.x} y={name.y - (name.lines.length - 1) * 14} textAnchor={name.anchor} className={on[k] ? "jc-gate" : "jc-gate off"}>
              {name.lines.map((line, n) => (
                <tspan key={n} x={name.x} dy={n === 0 ? 0 : 14}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={sub.x} y={sub.y} textAnchor={sub.anchor} className="s-lab" style={shown(!on[k])}>
              {m.off}
            </text>
          </g>
        );
      })}

      {/* el que frenó un control: su × y el código que devolvió jose */}
      {code && (
        <g style={{ ...STILL, opacity: code.opacity }}>
          <path d={xmark(code.gate[0], code.gate[1], 6)} className="s-x-bad" style={STILL} />
          <text x={code.at.x} y={code.at.y} textAnchor={code.at.anchor} className="jc-code" style={STILL}>
            {code.text}
          </text>
        </g>
      )}

      {/* el handler */}
      <Drawn pts={rectPts(H.x, H.y, H.w, H.h)} seed={1205} />
      <text x={H.x + 14} y={H.y + 24} className="s-title">
        {m.handler}
        <tspan className="s-lab" dx={8}>
          {m.handlerSub}
        </tspan>
      </text>
      <Glyph name="server" x={H.x + H.w - 30} y={H.y + 11} />
      {f.arrived.map((r, j) => {
        const row = G.row(j);
        return (
          <g key={r.index} style={{ ...STILL, opacity: r.opacity }}>
            {r.intrusion && <rect x={row.x - 6} y={row.y - 12} width={row.w} height={17} rx={3} className="jc-intrusion" />}
            <text x={row.x} y={row.y} className={r.intrusion ? "jc-row bad" : "jc-row"}>
              {m.short[TOKENS[r.index].id]}
            </text>
            {r.intrusion && (
              <text x={row.x + row.w - 12} y={row.y} textAnchor="end" className="jc-entered">
                {m.entered}
              </text>
            )}
          </g>
        );
      })}

      {/* el token en camino */}
      {dots && moving && at && (
        <MiniToken at={at} id={TOKENS[moving.index].id} breached={moving.breached} opacity={moving.opacity * enterOpacity} />
      )}
    </svg>
  );
}

function result(f: ChecksFrame) {
  if (f.done) {
    const entered = f.arrived.filter((r) => r.intrusion).length;
    return entered === 0 ? m.results.allOn : m.results.someOff(f.arrived.length, entered);
  }
  if (!f.last) return m.results.start;
  const id = TOKENS[f.last.index].id;
  if (id === "ok") return m.results.ok;
  return f.last.outcome === "caught" ? m.results.caught[id] : m.results.entered[id];
}

/** Figura: seis tokens contra los controles de jwtVerify; apagar uno deja pasar al que frenaba */
export function JwtChecks({ name, wide, label, caption }: FigureProps) {
  const [on, setOn] = useState<Enabled>(ALL_ON);
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(CK_START);
  const end = checksEnd(on);
  const f = simulateChecks(on, Math.min(t, end));
  const done = t >= end;
  const entered = f.arrived.filter((r) => r.intrusion).length;

  // al terminar el guion el reloj se detiene
  useEffect(() => {
    if (done && playing) toggle();
  }, [done, playing, toggle]);

  function flip(k: CheckId) {
    setOn((prev) => ({ ...prev, [k]: !prev[k] }));
    reset(0);
    play();
  }

  function again() {
    reset(0);
    play();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="presets" role="group" aria-label={m.checks}>
        <span className="muted" aria-hidden="true">
          {m.checksLabel}
        </span>
        {CHECKS.map((k) => (
          <button key={k} type="button" aria-pressed={on[k]} onClick={() => flip(k)}>
            {m.names[k]}
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} on={on} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} on={on} f={f} dots={!reduced} label={label} />
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
            {m.counters.arrived}
            <b className={entered > 0 ? "bad" : undefined}>{m.counters.of(f.arrived.length)}</b>
          </span>
          <span>
            {m.counters.stopped}
            <b>{f.stopped}</b>
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

"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, xmark, type Cubic, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.requestCapas;

export type CapasMode = keyof typeof m.modes;
export const MODES: CapasMode[] = ["sano", "dns", "tls", "proxy", "bind"];
/** Las capas, de afuera hacia adentro */
export type Layer = keyof typeof m.layers;
export const LAYERS: Layer[] = ["client", "dns", "tls", "proxy", "app"];
export type LogId = keyof typeof m.logNames;
export const LOGS: LogId[] = ["access", "error", "app"];

/** La capa donde está la causa de cada falla: su valor se marca en rojo */
export const CAUSE: Record<CapasMode, Layer | null> = { sano: null, dns: "dns", tls: "tls", proxy: "proxy", bind: "app" };

/* ---------- simulación ---------- */

/** De una capa a la siguiente */
const HOP = 0.45;
/** La app atiende la request */
const WORK = 0.3;
/** Del DNS al servidor viejo, y cuánto espera curl ahí (en el lab, 3 s) */
const VEER = 0.7;
const TIMEOUT = 1.6;
/** Hasta dónde llega Nginx hacia la app antes del Connection refused (en capas) */
export const REFUSED_AT = 3.8;
/** Nginx arma el 502 */
const TURN = 0.3;
/** El punto se queda frente al TLS y después se va */
const PARK = 0.5;
const FADE = 0.3;
/** Después del resultado de curl, antes de dar la corrida por terminada */
const TAIL = 0.4;

type Plan = {
  /** Cuando curl ya tiene su resultado */
  curl: number;
  end: number;
  /** Cuándo escribe su línea cada log (los que no están, no escriben) */
  writes: Partial<Record<LogId, number>>;
  /** Cuándo se ve la causa en rojo */
  fault: number;
};

function plan(mode: CapasMode): Plan {
  if (mode === "sano") {
    const atApp = 4 * HOP;
    const back = atApp + WORK;
    const curl = back + 4 * HOP;
    // la app escribe al atender; Nginx, cuando la respuesta pasa de vuelta por el proxy
    return { curl, end: curl + TAIL, writes: { app: atApp, access: back + HOP }, fault: Infinity };
  }
  if (mode === "dns") {
    const curl = HOP + VEER + TIMEOUT;
    return { curl, end: curl + TAIL, writes: {}, fault: HOP };
  }
  if (mode === "tls") {
    const curl = 2 * HOP;
    return { curl, end: curl + PARK + FADE, writes: {}, fault: curl };
  }
  const refused = REFUSED_AT * HOP;
  const back = refused + TURN;
  const curl = back + 3 * HOP;
  return { curl, end: curl + TAIL, writes: { error: refused, access: back }, fault: refused };
}

/** Cuando la corrida terminó; el reloj se detiene ahí */
export const capasEnd = (mode: CapasMode) => plan(mode).end;
/** El cuadro inicial: la corrida sana, terminada */
export const CAPAS_START = capasEnd("sano");

export type LogState = "wait" | "line" | "none";
export type CapasFrame = {
  /** Hasta dónde llegó la request por el recorrido, en capas (0 = tu terminal, 4 = la app) */
  reach: number;
  /** Cuánto del desvío al servidor viejo ya recorrió (0 a 1) */
  veer: number;
  /** El punto en camino: en capas sobre el recorrido, o de 0 a 1 sobre el desvío */
  dot: { kind: "req" | "res"; on: "track" | "veer"; s: number; opacity: number } | null;
  /** curl esperando al servidor viejo (0 a 1), mientras dura */
  wait: number | null;
  /** Dónde murió la request, con su × */
  dead: "dns" | "tls" | "upstream" | null;
  /** La capa con la causa en rojo, cuando ya se vio */
  fault: Layer | null;
  logs: Record<LogId, LogState>;
  curl: boolean;
  phase: "going" | "done";
  done: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Una request de tu terminal a la app, de afuera hacia adentro. Sana llega y
 * vuelve con 200; con DNS se desvía al servidor viejo y curl corta por
 * timeout; con TLS muere en el handshake; en los dos 502 Nginx no llega a la
 * app y contesta él. Función pura del tiempo.
 */
export function simulateCapas(mode: CapasMode, t: number): CapasFrame {
  const p = plan(mode);
  const over = t >= p.curl;
  const f: CapasFrame = {
    reach: 0,
    veer: 0,
    dot: null,
    wait: null,
    dead: null,
    fault: t >= p.fault ? CAUSE[mode] : null,
    logs: { access: "wait", error: "wait", app: "wait" },
    curl: over,
    phase: over ? "done" : "going",
    done: t >= p.end,
  };
  for (const id of LOGS) {
    const at = p.writes[id];
    f.logs[id] = at !== undefined && t >= at ? "line" : over ? "none" : "wait";
  }
  const going = (to: number) => {
    const s = Math.min(to, t / HOP);
    f.reach = s;
    if (t < to * HOP) f.dot = { kind: "req", on: "track", s, opacity: 1 };
  };

  if (mode === "sano") {
    going(4);
    const back = 4 * HOP + WORK;
    if (t >= back && t < p.curl) f.dot = { kind: "res", on: "track", s: 4 - (t - back) / HOP, opacity: 1 };
  } else if (mode === "dns") {
    going(1);
    const arrive = HOP + VEER;
    f.veer = clamp01((t - HOP) / VEER);
    if (t >= HOP && t < arrive) f.dot = { kind: "req", on: "veer", s: f.veer, opacity: 1 };
    else if (t >= arrive && t < p.curl) {
      f.dot = { kind: "req", on: "veer", s: 1, opacity: 1 };
      f.wait = (t - arrive) / TIMEOUT;
    }
    if (over) f.dead = "dns";
  } else if (mode === "tls") {
    going(2);
    if (over) {
      f.dead = "tls";
      // el punto se queda frente al TLS y se apaga justo cuando termina la corrida
      if (t < p.end) f.dot = { kind: "req", on: "track", s: 2, opacity: 1 - clamp01((t - p.curl - PARK) / FADE) };
    }
  } else {
    going(REFUSED_AT);
    const refused = REFUSED_AT * HOP;
    if (t >= refused) f.dead = "upstream";
    const back = refused + TURN;
    if (t >= back && t < p.curl) f.dot = { kind: "res", on: "track", s: 3 - (t - back) / HOP, opacity: 1 };
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
  box: (i: number) => Box;
  node: (i: number) => Pt;
  /** Del cuadro de la capa al recorrido */
  stem: (i: number) => [Pt, Pt];
  /** Título, rótulo y valor de cada capa (en la angosta, rótulo y valor van en un renglón) */
  title: (b: Box) => Pt;
  label: (b: Box) => Pt;
  value: ((b: Box) => Pt) | null;
  veer: Cubic;
  ghost: Box;
  refusedLabel: Pt;
  refusedAnchor: "middle" | "start";
  /** Dónde va el código de la respuesta respecto del punto (null: no va) */
  tag: Pt | null;
};

const WIDE_BOX = (i: number): Box => ({ x: i * 147, y: 0, w: 132, h: 74 });
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 170,
  box: WIDE_BOX,
  node: (i) => [WIDE_BOX(i).x + 66, 110],
  stem: (i) => [
    [WIDE_BOX(i).x + 66, 74],
    [WIDE_BOX(i).x + 66, 104],
  ],
  title: (b) => [b.x + 10, b.y + 24],
  label: (b) => [b.x + 10, b.y + 46],
  value: (b) => [b.x + 10, b.y + 63],
  veer: cubic([213, 110], [213, 140], [236, 152], [270, 152]),
  ghost: { x: 270, y: 137, w: 206, h: 30 },
  refusedLabel: [580, 134],
  refusedAnchor: "middle",
  tag: [0, -12],
};

const NARROW_Y = [0, 56, 160, 216, 304];
const NARROW_BOX = (i: number): Box => ({ x: 40, y: NARROW_Y[i], w: 340, h: 44 });
const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 348,
  box: NARROW_BOX,
  node: (i) => [16, NARROW_Y[i] + 22],
  stem: (i) => [
    [22, NARROW_Y[i] + 22],
    [40, NARROW_Y[i] + 22],
  ],
  title: (b) => [b.x + 12, b.y + 19],
  label: (b) => [b.x + 12, b.y + 36],
  value: null,
  veer: cubic([16, 78], [16, 112], [40, 129], [78, 129]),
  ghost: { x: 78, y: 114, w: 208, h: 30 },
  refusedLabel: [40, 286],
  refusedAnchor: "start",
  tag: null,
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });
const SEEDS = [1301, 1302, 1303, 1304, 1305];

/** Un punto del recorrido, en capas (0 a 4) */
function along(G: Geo, s: number): Pt {
  const i = Math.max(0, Math.min(3, Math.floor(s)));
  return lerp(G.node(i), G.node(i + 1), s - i);
}

/** El recorrido desde tu terminal hasta `s` */
function pathTo(G: Geo, s: number): string {
  const pts: Pt[] = [G.node(0)];
  for (let i = 1; i <= Math.floor(s) && i < LAYERS.length; i++) pts.push(G.node(i));
  if (s > Math.floor(s)) pts.push(along(G, s));
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
}

function Ring({ at, p }: { at: Pt; p: number | null }) {
  const r = 10;
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

function Scene({ G, mode, f, label }: { G: Geo; mode: CapasMode; f: CapasFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const ghostAt = G.veer.at(G.veer.length);
  const refusedAt = along(G, REFUSED_AT);
  const dot = f.dot;
  const dotAt = dot ? (dot.on === "veer" ? G.veer.at(G.veer.length * dot.s) : along(G, dot.s)) : null;
  const bad = mode !== "sano";

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el recorrido, y lo que la request ya hizo */}
      <path d={pathTo(G, 4)} className="s-guide" />
      <path d={pathTo(G, f.reach)} className="s-link" style={STILL} />

      {/* DNS: el desvío al servidor viejo */}
      <g style={shown(mode === "dns")}>
        <path d={G.veer.d} className="s-deadline" />
        <path
          d={G.veer.d}
          className="s-link"
          style={{ ...STILL, strokeDasharray: `${G.veer.dash} ${G.veer.dash}`, strokeDashoffset: G.veer.dash * (1 - f.veer) }}
        />
        <rect x={G.ghost.x} y={G.ghost.y} width={G.ghost.w} height={G.ghost.h} rx={4} className="sd-ghost" />
        <text x={G.ghost.x + 14} y={G.ghost.y + G.ghost.h / 2 + 4} className="s-lab">
          <tspan className="rq-val">{m.oldServer}</tspan>
          <tspan dx={5}>{m.oldServerNote}</tspan>
        </text>
        <Node cx={ghostAt[0]} cy={ghostAt[1]} r={4} />
      </g>

      {/* las capas */}
      {LAYERS.map((k, i) => {
        const b = G.box(i);
        const L = m.layers[k];
        const [tx, ty] = G.title(b);
        const [lx, ly] = G.label(b);
        const isFault = f.fault === k;
        const value = CAUSE[mode] === k ? m.values[k].bad : m.values[k].ok;
        const valueCls = isFault ? "rq-val bad" : "rq-val";
        const [s0, s1] = G.stem(i);
        const [nx, ny] = G.node(i);
        return (
          <g key={k}>
            <path d={`M${s0[0]} ${s0[1]}L${s1[0]} ${s1[1]}`} className="s-guide" />
            <Drawn pts={rectPts(b.x, b.y, b.w, b.h)} seed={SEEDS[i]} />
            <text x={tx} y={ty} className="s-title">
              {L.title}
              {L.sub && (
                <tspan className="s-lab" dx={5}>
                  {L.sub}
                </tspan>
              )}
            </text>
            <text x={lx} y={ly} className={k === "proxy" ? "s-lab s-mono" : "s-lab"}>
              {L.label}
              {!G.value && (
                <tspan className={valueCls} dx={6}>
                  {value}
                </tspan>
              )}
            </text>
            {G.value && (
              <text x={G.value(b)[0]} y={G.value(b)[1]} className={valueCls}>
                {value}
              </text>
            )}
            <Node cx={nx} cy={ny} r={5} className={f.reach >= i - 1e-9 ? "s-node rq-on" : "s-node"} />
          </g>
        );
      })}

      {/* dónde murió */}
      <path d={xmark(ghostAt[0], ghostAt[1], 7)} className="s-x-bad" style={shown(f.dead === "dns")} />
      <path d={xmark(G.node(2)[0], G.node(2)[1], 8)} className="s-x-bad" style={shown(f.dead === "tls")} />
      <g style={shown(f.dead === "upstream")}>
        <path d={xmark(refusedAt[0], refusedAt[1], 7)} className="s-x-bad" />
        <text x={G.refusedLabel[0]} y={G.refusedLabel[1]} textAnchor={G.refusedAnchor} className="s-lab s-mono">
          {m.refused}
        </text>
      </g>

      {/* curl esperando al servidor viejo */}
      <Ring at={ghostAt} p={f.wait} />

      {/* la request (llena) o la respuesta (hueca) */}
      {dot && dotAt && (
        <g style={{ ...STILL, opacity: dot.opacity }}>
          <circle
            cx={dotAt[0]}
            cy={dotAt[1]}
            r={dot.kind === "req" ? 5 : 5.5}
            className={dot.kind === "req" ? "s-req" : bad ? "s-res rq-res-bad" : "s-res"}
            style={STILL}
          />
          {dot.kind === "res" && G.tag && (
            <text
              x={dotAt[0] + G.tag[0]}
              y={dotAt[1] + G.tag[1]}
              textAnchor="middle"
              className={bad ? "rq-tag bad" : "rq-tag"}
              style={STILL}
            >
              {bad ? m.codes.bad : m.codes.ok}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/** Lo que ve curl y lo que quedó en cada log, en HTML para que corte en el celular */
function Output({ mode, f }: { mode: CapasMode; f: CapasFrame }) {
  const out = m.output[mode];
  const curlState = !f.curl ? "wait" : mode === "sano" ? "ok" : "bad";
  return (
    <div className="rq-out">
      <p className="rq-kicker">{m.curl}</p>
      <p className="rq-curl" data-state={curlState}>
        <code key={`${mode}-${curlState}`}>{f.curl ? out.curl : m.pending}</code>
      </p>
      <p className="rq-kicker">{m.logs}</p>
      {LOGS.map((id) => {
        const state = f.logs[id];
        const line = out.logs[id];
        const text =
          state === "line" && line ? line : state === "none" ? (id === "app" && out.rid ? m.noId(out.rid) : m.noLines) : m.pending;
        return (
          <div key={id} className="rq-row" data-log={id} data-state={state}>
            <span className="rq-name">
              {m.logNames[id]}
              <small>{m.logOwners[id]}</small>
            </span>
            <code key={`${mode}-${state}`} className="rq-line">
              {text}
            </code>
          </div>
        );
      })}
    </div>
  );
}

function result(mode: CapasMode, f: CapasFrame) {
  if (f.phase === "done") return m.results[mode];
  if (f.wait !== null) return m.results.waiting;
  if (f.dot?.kind === "res") return mode === "sano" ? m.results.back.ok : m.results.back.bad;
  return m.results.going;
}

/** Figura: una request por DNS, TLS, proxy y app; muere en la capa rota y cada log dice si se enteró */
export function RequestCapas({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<CapasMode>("sano");
  const [played, setPlayed] = useState(false);
  const { t, playing, canvas, play, toggle, reset } = usePlayClock(CAPAS_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateCapas(mode, Math.min(t, capasEnd(mode)));

  // al terminar la corrida el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function run(next: CapasMode) {
    setMode(next);
    setPlayed(true);
    // con reduced motion se salta al final: se entiende igual
    if (prefersReducedMotion()) {
      if (playing) toggle();
      reset(capasEnd(next));
      return;
    }
    reset(0);
    if (!playing) play();
  }

  function pick(next: CapasMode) {
    if (next !== mode) run(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const step = e.key === "ArrowRight" ? 1 : MODES.length - 1;
    const next = MODES[(MODES.indexOf(mode) + step) % MODES.length];
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
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} mode={mode} f={f} label={label} />
        <Scene G={NARROW} mode={mode} f={f} label={label} />
        <Output mode={mode} f={f} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          <button type="button" className="plain" onClick={() => run(mode)}>
            {played ? `↺ ${m.again}` : `▶ ${m.play}`}
          </button>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(mode, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.ufwCadenas;

export type CadenasMode = keyof typeof m.modes;
export const MODES: CadenasMode[] = ["publica", "loopback", "sin"];

/* ---------- el modelo (lo que documenta Docker) ---------- */

/** Dónde publica Docker el 5432 en cada caso (null: no lo publica) */
export const PUBLISH: Record<CadenasMode, "all" | "loopback" | null> = { publica: "all", loopback: "loopback", sin: null };

export type Route = "forward" | "input";

/**
 * Visto desde otra máquina: el puerto publicado en todas las direcciones se
 * desvía en la tabla nat hacia el contenedor, así que el paquete va por
 * FORWARD. Con 127.0.0.1 la doc dice solo el resultado (llega el host, nadie
 * más) y sin publicar no hay regla: en los dos el paquete sigue yendo al host.
 */
export const redirected = (mode: CadenasMode) => PUBLISH[mode] === "all";
export const routeOf = (mode: CadenasMode): Route => (redirected(mode) ? "forward" : "input");
/** ufw tiene sus reglas en INPUT: solo ve el paquete que pasa por ahí */
export const ufwSees = (mode: CadenasMode) => routeOf(mode) === "input";

/** Paradas del recorrido: 0 otra máquina, 1 PREROUTING, 2 ruteo, 3 FORWARD o INPUT, 4 db */
export const LAST: Record<Route, number> = { forward: 4, input: 3 };
export const CHAINS = m.chains.length;

/* ---------- simulación ---------- */

/** De una parada a la siguiente */
const HOP = 0.45;
/** En PREROUTING: cuánto se queda, y cuándo cambia el destino */
const NAT = 0.6;
const REWRITE = 0.25;
/** Cada cadena de FORWARD */
const CHAIN = 0.32;
/** En INPUT: cuándo coincide el deny de ufw, y cuándo lo descarta */
const MATCH = 0.15;
const RULE = 0.5;
/** El paquete descartado se apaga */
const FADE = 0.3;
const TAIL = 0.4;

type Plan = { pre: number; route: number; gate: number; leave: number; outcome: number; end: number };

function plan(mode: CadenasMode): Plan {
  const pre = HOP;
  const route = pre + NAT + HOP;
  const gate = route + HOP;
  if (routeOf(mode) === "forward") {
    const leave = gate + CHAINS * CHAIN;
    const outcome = leave + HOP;
    return { pre, route, gate, leave, outcome, end: outcome + TAIL };
  }
  const outcome = gate + RULE;
  return { pre, route, gate, leave: outcome, outcome, end: outcome + FADE + TAIL };
}

/** Cuando el recorrido terminó; el reloj se detiene ahí */
export const cadenasEnd = (mode: CadenasMode) => plan(mode).end;
/** El cuadro inicial: el puerto publicado, con el paquete ya en la base */
export const CADENAS_START = cadenasEnd("publica");

export type Phase = "out" | "nat" | "route" | "gate" | "done";
export type CadenasFrame = {
  route: Route;
  /** Hasta dónde llegó el paquete, en paradas */
  reach: number;
  dot: { s: number; opacity: number } | null;
  /** Ya pasó por la tabla nat: la caja muestra qué hizo */
  natSeen: boolean;
  /** La regla de Docker le cambió el destino a la IP del contenedor */
  rewritten: boolean;
  /** Cadenas de FORWARD que ya recorrió (0 a 3) */
  chains: number;
  /** El deny de ufw coincidió con el paquete */
  ufwMatched: boolean;
  dropped: boolean;
  arrived: boolean;
  phase: Phase;
  done: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Un paquete de otra máquina al 5432 del host. Si Docker lo desvía en la
 * tabla nat, va por FORWARD y llega a la base sin pasar por INPUT; si no, va
 * por INPUT y ufw lo descarta. Función pura del tiempo.
 */
export function simulateCadenas(mode: CadenasMode, t: number): CadenasFrame {
  const p = plan(mode);
  const route = routeOf(mode);
  const leavePre = p.pre + NAT;
  let s: number;
  if (t < p.pre) s = Math.max(0, t / HOP);
  else if (t < leavePre) s = 1;
  else if (t < p.route) s = 1 + (t - leavePre) / HOP;
  else if (t < p.gate) s = 2 + (t - p.route) / HOP;
  else if (t < p.leave) s = 3;
  else s = route === "forward" ? Math.min(4, 3 + (t - p.leave) / HOP) : 3;

  const settled = t >= p.outcome;
  const natSeen = t >= p.pre + REWRITE;
  const f: CadenasFrame = {
    route,
    reach: settled ? LAST[route] : s,
    dot: null,
    natSeen,
    rewritten: redirected(mode) && natSeen,
    chains: route === "forward" ? clamp(Math.ceil((t - p.gate) / CHAIN), 0, CHAINS) : 0,
    ufwMatched: route === "input" && t >= p.gate + MATCH,
    dropped: route === "input" && settled,
    arrived: route === "forward" && settled,
    phase: settled ? "done" : t >= p.gate ? "gate" : t >= p.route ? "route" : t >= p.pre ? "nat" : "out",
    done: t >= p.end,
  };
  if (!settled) f.dot = { s, opacity: 1 };
  else if (route === "input" && t < p.outcome + FADE) f.dot = { s: 3, opacity: 1 - (t - p.outcome) / FADE };
  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  src: Box;
  pre: Box;
  fwd: Box;
  db: Box;
  input: Box;
  /** Las paradas por FORWARD: otra máquina, PREROUTING, ruteo, FORWARD, db */
  track: Pt[];
  /** De la decisión de ruteo al borde de INPUT (puede doblar) */
  toInput: Pt[];
  /** Renglones dentro de una caja (0 = título) */
  row: (b: Box, k: number) => number;
  routeLabel: Pt;
  routeAnchor: "middle" | "start";
  inputStatus: Pt;
  inputAnchor: "start" | "end";
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 232,
  src: { x: 0, y: 0, w: 112, h: 96 },
  pre: { x: 132, y: 0, w: 184, h: 96 },
  fwd: { x: 376, y: 0, w: 204, h: 96 },
  db: { x: 600, y: 0, w: 120, h: 96 },
  input: { x: 376, y: 160, w: 204, h: 72 },
  track: [
    [56, 124],
    [224, 124],
    [346, 124],
    [478, 124],
    [660, 124],
  ],
  toInput: [
    [346, 124],
    [346, 194],
    [364, 194],
  ],
  row: (b, k) => b.y + 24 + 20 * k,
  routeLabel: [346, 110],
  routeAnchor: "middle",
  inputStatus: [596, 198],
  inputAnchor: "start",
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 386,
  src: { x: 40, y: 0, w: 340, h: 46 },
  pre: { x: 40, y: 66, w: 340, h: 64 },
  input: { x: 64, y: 150, w: 316, h: 66 },
  fwd: { x: 40, y: 236, w: 340, h: 84 },
  db: { x: 40, y: 340, w: 340, h: 46 },
  track: [
    [16, 23],
    [16, 98],
    [16, 183],
    [16, 278],
    [16, 363],
  ],
  toInput: [
    [16, 183],
    [54, 183],
  ],
  row: (b, k) => b.y + 19 + 18 * k,
  routeLabel: [22, 168],
  routeAnchor: "start",
  inputStatus: [368, 169],
  inputAnchor: "end",
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Los puntos de una polilínea hasta la fracción `q` de su largo */
function polyTo(pts: Pt[], q: number): Pt[] {
  const total = pts.slice(1).reduce((acc, b, i) => acc + dist(pts[i], b), 0);
  let left = clamp(q, 0, 1) * total;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (left >= d) {
      out.push(pts[i]);
      left -= d;
    } else {
      if (left > 0) out.push(lerp(pts[i - 1], pts[i], left / d));
      break;
    }
  }
  return out;
}

/** El recorrido de `route` hasta `s` (en paradas) */
function pointsTo(G: Geo, route: Route, s: number): Pt[] {
  const pts: Pt[] = [G.track[0]];
  for (let i = 0; i < LAST[route]; i++) {
    if (s <= i) break;
    const q = Math.min(1, s - i);
    const leg = i === 2 && route === "input" ? G.toInput : [G.track[i], G.track[i + 1]];
    pts.push(...polyTo(leg, q).slice(1));
  }
  return pts;
}

const pathD = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");

function Scene({ G, mode, f, label }: { G: Geo; mode: CadenasMode; f: CadenasFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { src, pre, fwd, db, input } = G;
  const pad = G.narrow ? 12 : 10;
  const dotPts = f.dot ? pointsTo(G, f.route, f.dot.s) : null;
  const dotAt = dotPts ? dotPts[dotPts.length - 1] : null;
  const stop = G.toInput[G.toInput.length - 1];
  const stems: [Box, Pt][] = [
    [src, G.track[0]],
    [pre, G.track[1]],
    [fwd, G.track[3]],
    [db, G.track[4]],
  ];
  const outcome = m.pre.outcome[mode];
  const outcomeCls = mode === "publica" ? (f.rewritten ? "uf-val hot" : "uf-val") : "s-lab";

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* los dos caminos posibles después del ruteo, y el que hizo el paquete */}
      <path d={pathD(pointsTo(G, "forward", LAST.forward))} className="s-guide" />
      <path d={pathD(G.toInput)} className="s-guide" />
      <path d={pathD(pointsTo(G, f.route, f.reach))} className="s-link" style={STILL} />
      {stems.map(([b, n], i) => {
        const from: Pt = G.narrow ? [b.x, n[1]] : [n[0], b.y + b.h];
        return <path key={i} d={pathD([from, n])} className="s-guide" />;
      })}

      {/* otra máquina */}
      <Drawn pts={rectPts(src.x, src.y, src.w, src.h)} seed={1501} />
      <text x={src.x + pad} y={G.row(src, 0)} className="s-title">
        {m.source.title}
      </text>
      {G.narrow ? (
        <text x={src.x + pad} y={G.row(src, 1)} className="s-lab">
          <tspan className="uf-val">{m.source.ip}</tspan>
          <tspan dx={6}>{m.source.arrow}</tspan>
          <tspan className="uf-val" dx={6}>
            {m.source.to}
          </tspan>
        </text>
      ) : (
        <>
          <text x={src.x + pad} y={G.row(src, 1)} className="uf-val">
            {m.source.ip}
          </text>
          <text x={src.x + pad} y={G.row(src, 2)} className="s-lab">
            {m.source.arrow}
            <tspan className="uf-val" dx={6}>
              {m.source.to}
            </tspan>
          </text>
        </>
      )}

      {/* PREROUTING: la tabla nat */}
      <Drawn pts={rectPts(pre.x, pre.y, pre.w, pre.h)} seed={1502} />
      <text x={pre.x + pad} y={G.row(pre, 0)} className="s-title">
        {m.pre.title}
        <tspan className="s-lab" dx={6}>
          {m.pre.sub}
        </tspan>
      </text>
      <text x={pre.x + pad} y={G.row(pre, 1)} className="s-lab">
        {m.pre.dest}
        <tspan className={f.rewritten ? "uf-val gone" : "uf-val"} dx={6}>
          {m.source.to}
        </tspan>
      </text>
      <text x={pre.x + pad} y={G.row(pre, 2)} className={outcomeCls} style={shown(f.natSeen)}>
        {outcome}
      </text>

      {/* la decisión de ruteo */}
      <text x={G.routeLabel[0]} y={G.routeLabel[1]} textAnchor={G.routeAnchor} className="s-lab">
        {m.route}
      </text>

      {/* FORWARD y las cadenas de Docker */}
      <Drawn pts={rectPts(fwd.x, fwd.y, fwd.w, fwd.h)} seed={1503} />
      <text x={fwd.x + pad} y={G.row(fwd, 0)} className="s-title">
        {m.forward.title}
        <tspan className="s-lab" dx={6}>
          {m.forward.sub}
        </tspan>
      </text>
      {m.chains.map((c, i) => {
        const y = G.row(fwd, i + 1);
        const on = f.chains > i;
        return (
          <g key={c.name}>
            <circle cx={fwd.x + pad + 4} cy={y - 4} r={3.5} className={on ? "uf-mark on" : "uf-mark"} />
            <text x={fwd.x + pad + 14} y={y} className={on ? "uf-chain on" : "uf-chain"}>
              {c.name}
              <tspan className="s-lab uf-note" dx={7} style={{ fillOpacity: on ? 1 : 0 }}>
                {c.note}
              </tspan>
            </text>
          </g>
        );
      })}

      {/* INPUT, donde ufw tiene sus reglas */}
      <Drawn pts={rectPts(input.x, input.y, input.w, input.h)} seed={1504} />
      <text x={input.x + pad} y={G.row(input, 0)} className="s-title">
        {m.input.title}
        <tspan className="s-lab" dx={6}>
          {m.input.sub}
        </tspan>
      </text>
      {m.input.rules.map((rule, i) => (
        <text key={rule} x={input.x + pad} y={G.row(input, i + 1)} className="s-lab">
          {i === 0 ? m.input.ufw : ""}
          <tspan
            x={input.x + pad + 30}
            className={i === 0 && f.ufwMatched ? "uf-val match" : "uf-val"}
          >
            {rule}
          </tspan>
        </text>
      ))}
      <text
        x={G.inputStatus[0]}
        y={G.inputStatus[1]}
        textAnchor={G.inputAnchor}
        className={f.dropped ? "uf-status ok" : "uf-status"}
        style={shown(f.dropped || f.arrived)}
      >
        {f.dropped ? m.status.drop : m.status.unseen}
      </text>

      {/* la base */}
      <Drawn pts={rectPts(db.x, db.y, db.w, db.h)} seed={1505} />
      <text x={db.x + pad} y={G.row(db, 0)} className="s-title">
        {m.db.title}
        <tspan className="s-lab" dx={6}>
          {m.db.sub}
        </tspan>
      </text>
      {!G.narrow && (
        <text x={db.x + pad} y={G.row(db, 1)} className="s-lab">
          {m.db.listen}
        </text>
      )}
      <text x={db.x + pad} y={G.row(db, G.narrow ? 1 : 2)} className="uf-val">
        {m.db.addr}
      </text>
      <text
        x={G.narrow ? db.x + db.w - pad : db.x + pad}
        y={G.row(db, G.narrow ? 1 : 3)}
        textAnchor={G.narrow ? "end" : "start"}
        className={f.arrived ? "uf-status hot" : "uf-status"}
        style={shown(f.arrived || f.dropped)}
      >
        {f.arrived ? m.status.in : m.status.out}
      </text>

      {/* las paradas */}
      {G.track.map(([x, y], i) => {
        const on = f.reach >= i - 1e-9 && (i < 3 || f.route === "forward");
        const hit = i === 4 && f.arrived;
        return <Node key={i} cx={x} cy={y} r={i === 2 ? 4 : 5} className={hit ? "s-node uf-hit" : on ? "s-node uf-on" : "s-node"} />;
      })}
      <circle
        cx={stop[0]}
        cy={stop[1]}
        r={5}
        className={f.route === "input" && f.reach >= 3 ? "s-node uf-on" : "s-node"}
        style={shown(!f.dropped)}
      />
      <path d={xmark(stop[0], stop[1], 6)} className="s-x" style={shown(f.dropped)} />

      {/* el paquete: un punto con su anillo, para que se vea sobre las paradas ya recorridas */}
      {f.dot && dotAt && (
        <g style={{ ...STILL, opacity: f.dot.opacity }}>
          <circle cx={dotAt[0]} cy={dotAt[1]} r={9.5} className="uf-ring" style={STILL} />
          <circle cx={dotAt[0]} cy={dotAt[1]} r={5} className="s-req" style={STILL} />
        </g>
      )}
    </svg>
  );
}

function result(mode: CadenasMode, f: CadenasFrame) {
  if (f.phase === "done") return m.results[mode];
  if (f.phase === "gate") return m.results.gate[f.route];
  if (f.phase === "route") return m.results.route[f.route];
  if (f.phase === "nat") return m.results.nat[mode];
  return m.results.out;
}

/** Figura: un paquete de afuera al 5432 del host; según cómo se publica, va por FORWARD (y ufw no lo ve) o por INPUT */
export function UfwCadenas({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<CadenasMode>("publica");
  const [played, setPlayed] = useState(false);
  const { t, playing, canvas, play, toggle, reset } = usePlayClock(CADENAS_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateCadenas(mode, Math.min(t, cadenasEnd(mode)));

  // al terminar el recorrido el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function run(next: CadenasMode) {
    setMode(next);
    setPlayed(true);
    // con reduced motion se salta al final: se entiende igual
    if (prefersReducedMotion()) {
      if (playing) toggle();
      reset(cadenasEnd(next));
      return;
    }
    reset(0);
    if (!playing) play();
  }

  function pick(next: CadenasMode) {
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

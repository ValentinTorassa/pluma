"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.ufwArreglos;

export type Option = keyof typeof m.options;
/** El punto de partida y los tres arreglos del artículo, en su orden */
export const OPTIONS: Option[] = ["abierto", "sinPorts", "loopback", "dockerUser"];
/** El cuadro inicial muestra el primer arreglo; el punto de partida queda a un clic */
export const FIRST: Option = "sinPorts";
export type Source = keyof typeof m.sources;
export const SOURCES: Source[] = ["app", "host", "lan", "internet"];
/** Los que llegan desde afuera del host */
export const OUTSIDE: readonly Source[] = ["lan", "internet"];

/* ---------- el modelo (lo que documenta Docker) ---------- */

/** yes: llega; no: no llega; only: de afuera, solo la IP que deja pasar la regla */
export type Reach = "yes" | "no" | "only";

/**
 * Quién llega a la base. «Port publishing and mapping»: publicar expone el
 * puerto también afuera, y con 127.0.0.1 solo llega el host (desde la
 * 28.0.0). «Docker with iptables»: por defecto cualquier IP de afuera llega a
 * un puerto publicado, y la regla negada en DOCKER-USER deja pasar solo una.
 * Para el host sin `ports`, la conexión es a localhost:5432; a la IP del
 * contenedor llega igual (lo aclara la nota).
 */
export const REACH: Record<Option, Record<Source, Reach>> = {
  abierto: { app: "yes", host: "yes", lan: "yes", internet: "yes" },
  sinPorts: { app: "yes", host: "no", lan: "no", internet: "no" },
  loopback: { app: "yes", host: "yes", lan: "no", internet: "no" },
  dockerUser: { app: "yes", host: "yes", lan: "only", internet: "only" },
};
/** La única IP de afuera que deja pasar la regla de ejemplo de la doc */
export const ALLOWED_IP = "192.0.2.2";

/** Llega alguien de afuera sin que nadie lo haya autorizado */
export const exposed = (o: Option, s: Source) => OUTSIDE.includes(s) && REACH[o][s] === "yes";

export type Note = { note: string; aside?: string; warn?: string };
export const NOTES: Record<Option, Record<Source, Note | null>> = m.notes;

/* ---------- simulación ---------- */

/** Cada origen sale un poco después del anterior */
const STAGGER = 0.14;
const FIRST_AT = 0.1;
/** De punta a punta */
const TRAVEL = 1.25;
/** Dónde queda frenado lo que no llega (fracción del camino) */
export const STOP_P = 0.62;
const FADE = 0.3;
const TAIL = 0.35;

const startOf = (i: number) => FIRST_AT + i * STAGGER;
const goal = (r: Reach) => (r === "yes" ? 1 : STOP_P);

function rowEnd(o: Option, i: number) {
  const r = REACH[o][SOURCES[i]];
  const settle = startOf(i) + goal(r) * TRAVEL;
  return r === "yes" ? settle : settle + FADE;
}

/** Cuando ya se resolvieron las cuatro conexiones; el reloj se detiene ahí */
export const arreglosEnd = (o: Option) => Math.max(...SOURCES.map((_, i) => rowEnd(o, i))) + TAIL;
export const ARREGLOS_START = arreglosEnd(FIRST);

export type RowFrame = {
  /** Hasta dónde llegó la conexión (0 = sale, 1 = la base) */
  p: number;
  dot: { p: number; opacity: number } | null;
  settled: boolean;
  arrived: boolean;
  blocked: boolean;
};
export type ArreglosFrame = { rows: Record<Source, RowFrame>; going: boolean; done: boolean };

/** Las cuatro conexiones a la base con la opción `o`. Función pura del tiempo */
export function simulateArreglos(o: Option, t: number): ArreglosFrame {
  const rows = {} as Record<Source, RowFrame>;
  SOURCES.forEach((s, i) => {
    const r = REACH[o][s];
    const g = goal(r);
    const t0 = startOf(i);
    const settleAt = t0 + g * TRAVEL;
    const p = Math.max(0, Math.min(g, (t - t0) / TRAVEL));
    const settled = t >= settleAt;
    let dot: RowFrame["dot"] = null;
    if (t >= t0 && !settled) dot = { p, opacity: 1 };
    else if (settled && r !== "yes" && t < settleAt + FADE) dot = { p: g, opacity: 1 - (t - settleAt) / FADE };
    rows[s] = { p, dot, settled, arrived: settled && r === "yes", blocked: settled && r !== "yes" };
  });
  return { rows, going: SOURCES.some((s) => !rows[s].settled), done: t >= arreglosEnd(o) };
}

/* ---------- dibujo ---------- */

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  /** El renglón del camino de cada origen */
  lineY: (i: number) => number;
  nodeX: number;
  dbX: number;
  title: (i: number) => Pt;
  /** El subtítulo del origen (en la angosta va en el mismo renglón que el título) */
  sub: ((i: number) => Pt) | null;
  via: (i: number) => Pt;
  verdict: (i: number) => Pt;
  note: (i: number) => Pt;
  /** El matiz o la advertencia; null: van en el mismo renglón que la nota */
  aside: ((i: number) => Pt) | null;
  db: { x: number; y: number; w: number; h: number };
  dbSub: boolean;
};

const WIDE_Y = [30, 88, 146, 204];
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 232,
  lineY: (i) => WIDE_Y[i],
  nodeX: 186,
  dbX: 632,
  title: (i) => [0, WIDE_Y[i] - 3],
  sub: (i) => [0, WIDE_Y[i] + 14],
  via: (i) => [200, WIDE_Y[i] - 8],
  verdict: (i) => [622, WIDE_Y[i] - 8],
  note: (i) => [200, WIDE_Y[i] + 21],
  aside: null,
  db: { x: 632, y: 0, w: 88, h: 232 },
  dbSub: true,
};

const ROW = 84;
const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 330,
  lineY: (i) => i * ROW + 40,
  nodeX: 6,
  dbX: 344,
  title: (i) => [0, i * ROW + 14],
  sub: null,
  via: (i) => [20, i * ROW + 33],
  verdict: (i) => [334, i * ROW + 33],
  note: (i) => [20, i * ROW + 58],
  aside: (i) => [20, i * ROW + 74],
  db: { x: 344, y: 0, w: 36, h: 330 },
  dbSub: false,
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, o, f, label }: { G: Geo; o: Option; f: ArreglosFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { db } = G;
  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      <Drawn pts={rectPts(db.x, db.y, db.w, db.h)} seed={1601} />
      <text x={db.x + (G.narrow ? 8 : 12)} y={db.y + 24} className="s-title">
        {m.db.title}
      </text>
      {G.dbSub && (
        <text x={db.x + 12} y={db.y + 42} className="s-lab">
          {m.db.sub}
        </text>
      )}

      {SOURCES.map((s, i) => {
        const y = G.lineY(i);
        const from: Pt = [G.nodeX, y];
        const to: Pt = [G.dbX, y];
        const r = REACH[o][s];
        const row = f.rows[s];
        const hot = exposed(o, s);
        const src = m.sources[s];
        const n = NOTES[o][s];
        const reached = lerp(from, to, row.p);
        const stop = lerp(from, to, STOP_P);
        const dotAt = row.dot ? lerp(from, to, row.dot.p) : null;
        const extra = n?.warn ?? n?.aside;
        const extraCls = n?.warn ? "uf-warn" : undefined;
        return (
          <g key={s}>
            <text x={G.title(i)[0]} y={G.title(i)[1]} className="s-title">
              {src.title}
              {!G.sub && src.sub && (
                <tspan className="s-lab" dx={6}>
                  {src.sub}
                </tspan>
              )}
            </text>
            {G.sub && src.sub && (
              <text x={G.sub(i)[0]} y={G.sub(i)[1]} className="s-lab">
                {src.sub}
              </text>
            )}

            {/* el camino posible y lo que la conexión ya recorrió */}
            <path d={`M${from[0]} ${y}H${to[0]}`} className="s-guide" />
            <path d={`M${from[0]} ${y}L${reached[0]} ${y}`} className={hot ? "s-live" : "s-link"} style={STILL} />
            <text x={G.via(i)[0]} y={G.via(i)[1]} className="uf-via">
              {m.via[s]}
            </text>
            <text
              x={G.verdict(i)[0]}
              y={G.verdict(i)[1]}
              textAnchor="end"
              className={`uf-verdict ${r}${hot ? " hot" : ""}`}
              style={shown(row.settled)}
            >
              {m.verdicts[r]}
            </text>
            <path d={xmark(stop[0], y, 4.5)} className="s-x" style={shown(row.blocked)} />
            <Node cx={from[0]} cy={y} r={4.5} />
            <Node cx={to[0]} cy={y} r={4.5} className={row.arrived ? (hot ? "s-node uf-hit" : "s-node uf-on") : "s-node"} />

            {/* por qué */}
            {n && (
              <g style={shown(row.settled)}>
                <text x={G.note(i)[0]} y={G.note(i)[1]} className="s-lab">
                  {n.note}
                  {extra && !G.aside && (
                    <tspan className={extraCls}>
                      {" · "}
                      {extra}
                    </tspan>
                  )}
                </text>
                {extra && G.aside && (
                  <text x={G.aside(i)[0]} y={G.aside(i)[1]} className="s-lab">
                    <tspan className={extraCls}>{extra}</tspan>
                  </text>
                )}
              </g>
            )}

            {dotAt && row.dot && (
              <circle cx={dotAt[0]} cy={y} r={4.5} className="s-req" style={{ ...STILL, opacity: row.dot.opacity }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** La línea del compose (y la regla, en DOCKER-USER), en HTML para que corte en el celular */
function Config({ o }: { o: Option }) {
  const c = m.config[o];
  const lines = c.lines.join("\n");
  return (
    <div className="uf-out">
      <p className="uf-kicker">{m.compose}</p>
      <code key={o}>{c.removed ? <del>{lines}</del> : lines}</code>
      {c.removed && <p className="uf-gone">{m.removed}</p>}
      {c.rule && (
        <>
          <p className="uf-kicker">{m.hostRule}</p>
          <code>{c.rule}</code>
        </>
      )}
    </div>
  );
}

/** Figura: las tres formas de cerrar el 5432 (y el punto de partida), con quién llega a la base en cada una */
export function UfwArreglos({ name, wide, label, caption }: FigureProps) {
  const [opt, setOpt] = useState<Option>(FIRST);
  const [played, setPlayed] = useState(false);
  const { t, playing, canvas, play, toggle, reset } = usePlayClock(ARREGLOS_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateArreglos(opt, Math.min(t, arreglosEnd(opt)));

  // con las cuatro conexiones resueltas el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function run(next: Option) {
    setOpt(next);
    setPlayed(true);
    // con reduced motion se salta al final: se entiende igual
    if (prefersReducedMotion()) {
      if (playing) toggle();
      reset(arreglosEnd(next));
      return;
    }
    reset(0);
    if (!playing) play();
  }

  function pick(next: Option) {
    if (next !== opt) run(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const step = e.key === "ArrowRight" ? 1 : OPTIONS.length - 1;
    const next = OPTIONS[(OPTIONS.indexOf(opt) + step) % OPTIONS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.option} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.optionLabel}</span>
        {OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={opt === o}
            tabIndex={opt === o ? 0 : -1}
            data-mode={o}
            onClick={() => pick(o)}
          >
            {m.options[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} o={opt} f={f} label={label} />
        <Scene G={NARROW} o={opt} f={f} label={label} />
        <Config o={opt} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          <button type="button" className="plain" onClick={() => run(opt)}>
            {played ? `↺ ${m.again}` : `▶ ${m.play}`}
          </button>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(f.going ? m.results.going : m.results[opt])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, sheetPts, xmark, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, STILL, usePlayClock } from "./sim";

const m = copy.figures.allowlistEgress;

export type Version = "v03" | "v04";
const VERSIONS: Version[] = ["v03", "v04"];

export type Gate = "value" | "tool" | "dest" | "path";
/** En orden de paso: el control del valor (0.4.0) va antes que cualquier regla de la allowlist */
export const GATES: Gate[] = ["value", "tool", "dest", "path"];
/** Dónde está cada control en el camino, de 0 (sale del agente) a 1 (llega al sitio) */
export const GATE_AT: Record<Gate, number> = { value: 0.12, tool: 0.38, dest: 0.64, path: 0.9 };

/**
 * Las tres requests del artículo y dónde las frena cada versión. En 0.3.0 no
 * las frena nadie; en 0.4.0 secret-egress rechaza las que llevan el valor y
 * sh-paths, la que nombra el archivo con @.
 */
export const REQUESTS: readonly { secret: boolean; stop: Record<Version, Gate | null> }[] = [
  { secret: false, stop: { v03: null, v04: "path" } },
  { secret: true, stop: { v03: null, v04: "value" } },
  { secret: true, stop: { v03: null, v04: "value" } },
];

/* ---------- simulación ---------- */

/** Cuándo sale cada request y cuánto tarda de punta a punta */
const SEND = [0, 1.3, 2.6] as const;
const TRAVEL = 2.7;
/** Cuánto se ve el ✓ de un control que la dejó pasar */
const CHECK = 0.6;
/** Lo que tarda en apagarse una request frenada */
const FADE = 0.35;
export const AE_END = SEND[2] + TRAVEL + 0.5;
/** El cuadro inicial: el .env ya llegó y la key va en camino */
export const AE_START = 3.0;

export type EgressFrame = {
  chips: { i: number; u: number; opacity: number }[];
  checks: { key: string; gate: Gate; opacity: number }[];
  hits: { key: string; gate: Gate; opacity: number }[];
  /** Los controles que ya frenaron alguna request (queda la regla escrita) */
  stopped: Gate[];
  arrived: number[];
  refused: number;
  done: boolean;
};

export const gatesOf = (v: Version): Gate[] => (v === "v04" ? GATES : GATES.slice(1));

/** Qué pasa en el segundo `t` con la versión `v`. Función pura del tiempo. */
export function simulateEgress(v: Version, t: number): EgressFrame {
  const f: EgressFrame = { chips: [], checks: [], hits: [], stopped: [], arrived: [], refused: 0, done: t >= AE_END };
  REQUESTS.forEach((r, i) => {
    const s = SEND[i];
    if (t < s) return;
    const u = (t - s) / TRAVEL;
    const stop = r.stop[v];
    const uStop = stop ? GATE_AT[stop] : 1;
    for (const g of gatesOf(v)) {
      const tg = s + GATE_AT[g] * TRAVEL;
      if (GATE_AT[g] < uStop && t >= tg && t < tg + CHECK) f.checks.push({ key: `${i}${g}`, gate: g, opacity: 1 - (t - tg) / CHECK });
    }
    if (u < uStop) {
      f.chips.push({ i, u, opacity: 1 });
      return;
    }
    const ts = s + uStop * TRAVEL;
    if (!stop) {
      f.arrived.push(i);
      return;
    }
    f.refused++;
    if (!f.stopped.includes(stop)) f.stopped.push(stop);
    if (t < ts + FADE) f.chips.push({ i, u: uStop, opacity: 1 - (t - ts) / FADE });
    if (t < ts + FLASH) f.hits.push({ key: `${i}`, gate: stop, opacity: 1 - (t - ts) / FLASH });
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
  /** Punto del camino para un avance u (centro de la request) */
  at: (u: number) => Pt;
  wire: [Pt, Pt];
  agent: Box;
  env: Box;
  dest: Box;
  /** La barra de cada control */
  bar: (g: Gate) => Box;
  /** Rótulo del control, lo que deja pasar y el resultado (✓ o la regla que la frenó) */
  concept: (g: Gate) => Pt;
  value: (g: Gate) => Pt;
  outcome: (g: Gate) => Pt;
  anchor: "middle" | "start";
  bracket: string;
  bracketLabel: Pt;
  bracketAnchor: "middle" | "end";
  knows: string;
  knowsLabel: Pt;
  knowsAnchor: "start" | "end";
  rows: Pt[];
  got: Pt;
};

const WA = 163;
const WL = 364;
const wx = (g: Gate) => WA + GATE_AT[g] * WL;
const WY = 112;

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 250,
  at: (u) => [WA + u * WL, WY],
  wire: [
    [100, WY],
    [588, WY],
  ],
  agent: { x: 0, y: 84, w: 100, h: 56 },
  env: { x: 0, y: 176, w: 170, h: 70 },
  dest: { x: 588, y: 52, w: 132, h: 120 },
  bar: (g) => ({ x: wx(g) - 7, y: WY - 22, w: 14, h: 44 }),
  concept: (g) => [wx(g), 66],
  value: (g) => [wx(g), 156],
  outcome: (g) => [wx(g), 84],
  anchor: "middle",
  bracket: `M${wx("tool") - 44} 50v-8H${wx("path") + 50}v8`,
  bracketLabel: [(wx("tool") + wx("path")) / 2 + 3, 34],
  bracketAnchor: "middle",
  knows: `M${wx("value")} ${WY + 22}V211H170`,
  knowsLabel: [wx("value") + 8, 230],
  knowsAnchor: "start",
  rows: [
    [600, 120],
    [600, 138],
    [600, 156],
  ],
  got: [600, 98],
};

const NA = 70;
const NL = 288;
const ny = (g: Gate) => NA + GATE_AT[g] * NL;
const NX = 50;

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 466,
  at: (u) => [NX, NA + u * NL],
  wire: [
    [NX, 56],
    [NX, 372],
  ],
  agent: { x: 0, y: 0, w: 150, h: 56 },
  env: { x: 196, y: 0, w: 184, h: 64 },
  dest: { x: 0, y: 372, w: 380, h: 94 },
  bar: (g) => ({ x: NX - 24, y: ny(g) - 7, w: 48, h: 14 }),
  concept: (g) => [112, ny(g) - 6],
  value: (g) => [112, ny(g) + 10],
  outcome: (g) => [112, ny(g) + (g === "value" ? 10 : 26)],
  anchor: "start",
  bracket: `M356 ${ny("tool") - 12}h8V${ny("path") + 12}h-8`,
  bracketLabel: [364, ny("tool") - 20],
  bracketAnchor: "end",
  knows: `M288 64V${ny("value") - 10}H152`,
  knowsLabel: [282, 84],
  knowsAnchor: "end",
  rows: [
    [84, 420],
    [84, 438],
    [84, 456],
  ],
  got: [14, 420],
};

const CHAR = 7.2;
const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Chip({ at, text, secret, opacity }: { at: Pt; text: string; secret: boolean; opacity: number }) {
  const w = text.length * CHAR + 16;
  const h = 20;
  return (
    <g style={{ ...STILL, opacity, transform: tr(at[0] - w / 2, at[1] - h / 2) }}>
      <rect width={w} height={h} rx={4} className="s-fill" style={STILL} />
      <rect width={w} height={h} rx={4} className={secret ? "s-tag-key" : "s-tag-ink"} style={STILL} />
      <text x={8} y={14} className={secret ? "t-key" : "t-ink"} style={STILL}>
        {text}
      </text>
    </g>
  );
}

function Scene({ G, v, f, dots, label }: { G: Geo; v: Version; f: EgressFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { agent: A, env: E, dest: D } = G;
  const v04 = v === "v04";
  const gates = gatesOf(v);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el camino de punta a punta */}
      <path d={`M${G.wire[0][0]} ${G.wire[0][1]}L${G.wire[1][0]} ${G.wire[1][1]}`} className="s-link" />

      {/* la allowlist: herramienta, destino y ruta */}
      <path d={G.bracket} className="s-bracket" />
      <text x={G.bracketLabel[0]} y={G.bracketLabel[1]} textAnchor={G.bracketAnchor} className="s-lab">
        {m.allowlist}
      </text>

      {/* lo que el firewall sabe en 0.4.0: el valor del .env */}
      <g style={shown(v04)}>
        <path d={G.knows} className="s-guide" />
        <text x={G.knowsLabel[0]} y={G.knowsLabel[1]} textAnchor={G.knowsAnchor} className="s-lab">
          {m.knows}
        </text>
      </g>

      {GATES.map((g, i) => {
        const b = G.bar(g);
        const [cx, cy] = G.concept(g);
        const [vx, vy] = G.value(g);
        const on = gates.includes(g);
        return (
          <g key={g} style={shown(on)}>
            <Drawn pts={rectPts(b.x, b.y, b.w, b.h)} seed={1101 + i} />
            <text x={cx} y={cy} textAnchor={G.anchor} className="s-lab">
              {m.gates[g]}
            </text>
            {g === "tool" &&
              (G.narrow ? (
                <text x={vx} y={vy} className="ae-val">
                  {m.toolNarrow}
                </text>
              ) : (
                m.tool.map((name, j) => (
                  <text key={name} x={vx} y={vy + j * 14} textAnchor="middle" className="ae-val">
                    {name}
                  </text>
                ))
              ))}
            {(g === "dest" || g === "path") && (
              <text x={vx} y={vy} textAnchor={G.anchor} className="ae-val">
                {g === "dest" ? m.dest : m.path}
              </text>
            )}
          </g>
        );
      })}

      {/* la regla que frenó algo queda escrita sobre el control */}
      {(["value", "path"] as const).map((g) => {
        const [ox, oy] = G.outcome(g);
        const at = G.at(GATE_AT[g]);
        const on = f.stopped.includes(g);
        return (
          <g key={g} style={shown(on)}>
            <text x={ox} y={oy} textAnchor={G.anchor} className="ae-rule">
              {m.rules[g]}
            </text>
            <path d={xmark(at[0], at[1], 5)} className="s-x" />
          </g>
        );
      })}

      {/* el agente */}
      <Drawn pts={rectPts(A.x, A.y, A.w, A.h)} seed={1111} />
      <text x={A.x + 12} y={A.y + 24} className="s-title">
        {m.agent}
      </text>
      <text x={A.x + 12} y={A.y + 42} className="s-lab">
        {m.agentSub}
      </text>
      <Glyph name="bot" x={A.x + A.w - 26} y={A.y + 10} />

      {/* el .env con la key */}
      <Drawn pts={sheetPts(E.x, E.y, E.w, E.h, 10)} seed={1112} fold={10} />
      <text x={E.x + 12} y={E.y + 20} className="s-file">
        {m.env}
      </text>
      <text x={E.x + 12} y={E.y + 38} className="s-file">
        {m.envKey}
      </text>
      <g className="is-key">
        <rect x={E.x + 6} y={E.y + 44} width={E.w - 12} height={19} rx={3} className="s-keybg" />
        <text x={E.x + 12} y={E.y + 58} className="s-file">
          {m.envValue}
        </text>
      </g>

      {/* el sitio permitido y lo que le llegó */}
      <Drawn pts={rectPts(D.x, D.y, D.w, D.h)} seed={1113} />
      <text x={D.x + 12} y={D.y + 24} className="s-title">
        {m.site}
      </text>
      {G.narrow && <Glyph name="globe" x={D.x + D.w - 34} y={D.y + 12} />}
      <text x={G.got[0]} y={G.got[1]} className="s-lab">
        {m.got}
      </text>
      {m.received.map((text, i) => (
        <text key={text} x={G.rows[i][0]} y={G.rows[i][1]} className="ae-got" style={shown(f.arrived.includes(i))}>
          {text}
        </text>
      ))}
      <text x={G.rows[0][0]} y={G.rows[0][1]} className="ae-none" style={shown(f.done && f.arrived.length === 0)}>
        {m.nothing}
      </text>

      {/* en vuelo */}
      {f.checks.map((c) => {
        const [ox, oy] = G.outcome(c.gate);
        const x = G.narrow ? ox : ox - 6;
        return (
          <g key={c.key} style={{ ...STILL, opacity: c.opacity }}>
            <Glyph name="check" x={x} y={oy - 12} s={12} />
          </g>
        );
      })}
      {dots &&
        f.chips.map((c) => (
          <Chip key={c.i} at={G.at(c.u)} text={m.requests[c.i]} secret={REQUESTS[c.i].secret} opacity={c.opacity} />
        ))}
      {f.hits.map((h) => {
        const at = G.at(GATE_AT[h.gate]);
        return <path key={h.key} d={xmark(at[0], at[1], 8)} className="s-x" style={{ ...STILL, opacity: h.opacity }} />;
      })}
    </svg>
  );
}

function result(v: Version, f: EgressFrame) {
  if (f.done) return v === "v04" ? m.results.v04Done : m.results.v03Done;
  return m.results[v];
}

/** Figura: tres requests que la allowlist deja pasar, y lo que cambia cuando el firewall conoce el valor */
export function AllowlistEgress({ name, wide, label, caption }: FigureProps) {
  const [v, setV] = useState<Version>("v03");
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(AE_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateEgress(v, Math.min(t, AE_END));

  // al terminar las tres requests el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function pick(next: Version) {
    if (next === v) return;
    setV(next);
    reset(0);
    play();
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = VERSIONS[(VERSIONS.indexOf(v) + 1) % VERSIONS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  function again() {
    reset(0);
    play();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.version} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.versionLabel}</span>
        {VERSIONS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={v === o}
            tabIndex={v === o ? 0 : -1}
            data-mode={o}
            className="font-mono"
            onClick={() => pick(o)}
          >
            {m.versions[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} v={v} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} v={v} f={f} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          {f.done ? (
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
            <b className={f.arrived.length > 0 ? "bad" : undefined}>{f.arrived.length}</b>
          </span>
          <span>
            {m.counters.refused}
            <b>{f.refused}</b>
          </span>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(v, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

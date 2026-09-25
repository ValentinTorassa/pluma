"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, inFlight, lerp, sent, SPEED, STILL, usePlayClock } from "./sim";

const m = copy.figures.bindScope;

export type Mode = "open" | "local";
const MODES: Mode[] = ["open", "local"];
const ADDR: Record<Mode, string> = { open: "0.0.0.0", local: "127.0.0.1" };

/* ---------- simulación ---------- */

/** Cada cliente manda un pedido cada `period` segundos, empezando en `offset` */
const SCHEDULE = {
  browser: { period: 1.5, offset: 0.1 },
  lan: { period: 1.9, offset: 0.6 },
  net: { period: 2.8, offset: 1.2 },
} as const;
/** El cuadro que se ve antes de tocar nada: pedidos en vuelo y un .env que ya salió */
export const START_T = 4.2;

/** Cambios de dirección en el tiempo de la simulación, en orden */
export type Timeline = readonly { t: number; mode: Mode }[];

export function modeAt(tl: Timeline, t: number): Mode {
  let mode = tl[0].mode;
  for (const e of tl) if (e.t <= t) mode = e.mode;
  return mode;
}

export type SimGeo = { toBrowser: Cubic; lan: Cubic; refused: number; netFrom: Pt; netTo: Pt };
type Dot = { key: string; at: Pt; kind: "req" | "res" | "leak" };
type Flash = { key: string; at: Pt; opacity: number };
export type SimFrame = { dots: Dot[]; flashes: Flash[]; served: number; leaked: number; refused: number; dropped: number };

/**
 * Qué se ve en el segundo `t`: puntos en vuelo, × que se apagan y lo que pasó
 * desde el último cambio de dirección. Es una función pura del tiempo: el
 * servidor y el navegador dibujan el mismo cuadro.
 */
export function simulate(G: SimGeo, tl: Timeline, t: number): SimFrame {
  const since = tl[tl.length - 1].t;
  const f: SimFrame = { dots: [], flashes: [], served: 0, leaked: 0, refused: 0, dropped: 0 };

  // tu navegador: siempre llega, y la respuesta vuelve por el mismo camino
  const Lb = G.toBrowser.length;
  for (const s of sent(t, SCHEDULE.browser)) {
    const back = s + (2 * Lb) / SPEED;
    if (back <= t && back >= since) f.served++;
  }
  for (const s of inFlight(t, SCHEDULE.browser, (2 * Lb) / SPEED)) {
    const arrive = s + Lb / SPEED;
    if (t < arrive) f.dots.push({ key: `b${s}`, at: G.toBrowser.at(SPEED * (t - s)), kind: "req" });
    else if (t < arrive + Lb / SPEED) f.dots.push({ key: `b${s}`, at: G.toBrowser.at(Lb - SPEED * (t - arrive)), kind: "res" });
  }

  // otra máquina de la red: al llegar al borde de tu máquina se decide según la dirección de ese momento
  const Ll = G.lan.length;
  const edge = (s: number) => s + (Ll - G.refused) / SPEED;
  for (const s of sent(t, SCHEDULE.lan)) {
    const te = edge(s);
    if (te > t) continue;
    if (modeAt(tl, te) === "local") {
      if (te >= since) f.refused++;
    } else {
      const back = s + (2 * Ll) / SPEED;
      if (back <= t && back >= since) f.leaked++;
    }
  }
  for (const s of inFlight(t, SCHEDULE.lan, (2 * Ll) / SPEED + FLASH)) {
    const te = edge(s);
    const going = G.lan.at(Ll - SPEED * (t - s));
    if (t < te) {
      f.dots.push({ key: `l${s}`, at: going, kind: "req" });
      continue;
    }
    if (modeAt(tl, te) === "local") {
      if (t < te + FLASH) f.flashes.push({ key: `l${s}`, at: G.lan.at(G.refused), opacity: 1 - (t - te) / FLASH });
      continue;
    }
    const arrive = s + Ll / SPEED;
    if (t < arrive) f.dots.push({ key: `l${s}`, at: going, kind: "req" });
    else if (t < arrive + Ll / SPEED) f.dots.push({ key: `l${s}`, at: G.lan.at(SPEED * (t - arrive)), kind: "leak" });
  }

  // internet: el router lo corta, con cualquier dirección
  const Ln = Math.hypot(G.netTo[0] - G.netFrom[0], G.netTo[1] - G.netFrom[1]);
  for (const s of sent(t, SCHEDULE.net)) {
    const ta = s + Ln / SPEED;
    if (ta <= t && ta >= since) f.dropped++;
  }
  for (const s of inFlight(t, SCHEDULE.net, Ln / SPEED + FLASH)) {
    const ta = s + Ln / SPEED;
    if (t < ta) f.dots.push({ key: `n${s}`, at: lerp(G.netFrom, G.netTo, (t - s) / (ta - s)), kind: "req" });
    else if (t < ta + FLASH) f.flashes.push({ key: `n${s}`, at: G.netTo, opacity: 1 - (t - ta) / FLASH });
  }

  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = SimGeo & {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  machine: Box;
  browser: Box;
  browserTally: Pt;
  proc: Box;
  port: Pt;
  procLink: [Pt, Pt];
  bindAt: Pt;
  laptop: Pt;
  lanLabel: Pt;
  chip: Box;
  lanTally: Pt;
  router: [Pt, Pt];
  routerLabel: Pt;
  routerAnchor: "start" | "end";
  globe: Pt;
  netLabel: Pt;
  netTally: Pt;
  net: Cubic;
};

const WIDE_NET = cubic([316, 188], [420, 188], [500, 236], [600, 236]);
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 290,
  machine: { x: 0, y: 30, w: 316, h: 236 },
  browser: { x: 18, y: 70, w: 132, h: 40 },
  browserTally: [20, 125],
  proc: { x: 18, y: 132, w: 214, h: 112 },
  port: [316, 188],
  procLink: [
    [232, 188],
    [316, 188],
  ],
  bindAt: [326, 214],
  laptop: [440, 88],
  lanLabel: [430, 136],
  chip: { x: 424, y: 148, w: 170, h: 24 },
  lanTally: [426, 192],
  refused: 26,
  router: [
    [600, 0],
    [600, 290],
  ],
  routerLabel: [608, 14],
  routerAnchor: "start",
  globe: [640, 214],
  netLabel: [636, 256],
  netTally: [612, 274],
  net: WIDE_NET,
  netFrom: [652, 226],
  netTo: [600, 236],
  lan: cubic([316, 188], [376, 188], [372, 100], [432, 100]),
  toBrowser: cubic([150, 90], [262, 90], [288, 188], [316, 188]),
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 446,
  machine: { x: 0, y: 28, w: 380, h: 190 },
  browser: { x: 236, y: 64, w: 130, h: 38 },
  browserTally: [236, 58],
  proc: { x: 14, y: 66, w: 206, h: 112 },
  port: [117, 218],
  procLink: [
    [117, 178],
    [117, 218],
  ],
  bindAt: [136, 244],
  laptop: [105, 290],
  lanLabel: [140, 300],
  chip: { x: 140, y: 312, w: 150, h: 24 },
  lanTally: [142, 354],
  refused: 18,
  router: [
    [0, 372],
    [380, 372],
  ],
  routerLabel: [380, 366],
  routerAnchor: "end",
  globe: [28, 398],
  netLabel: [60, 416],
  netTally: [60, 434],
  net: cubic([117, 218], [44, 236], [40, 320], [40, 372]),
  netFrom: [40, 410],
  netTo: [40, 372],
  lan: cubic([117, 218], [117, 244], [117, 262], [117, 288]),
  toBrowser: cubic([301, 102], [301, 190], [168, 218], [117, 218]),
};

function Chip({ x, y, w, h, kind, text, style }: Box & { kind: "key" | "dead"; text: string; style: CSSProperties }) {
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

function Scene({ G, tl, t, dots, label }: { G: Geo; tl: Timeline; t: number; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { machine: Mb, browser: B, proc: P } = G;
  const mode = tl[tl.length - 1].mode;
  const open = mode === "open";
  const sim = simulate(G, tl, t);
  const refusedAt = G.lan.at(G.refused);
  const netEnd = G.net.at(G.net.length);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      <text x={0} y={14} className="s-lab">
        {m.yourNet}
      </text>
      <path d={`M${G.router[0][0]} ${G.router[0][1]}L${G.router[1][0]} ${G.router[1][1]}`} className="s-guide" />
      <text x={G.routerLabel[0]} y={G.routerLabel[1]} textAnchor={G.routerAnchor} className="s-lab">
        {m.router}
      </text>

      {/* internet: el router lo corta en los dos modos */}
      <path d={G.net.d} className="s-deadline" />
      <path d={xmark(netEnd[0], netEnd[1], 5)} className="s-x" />
      <Glyph name="globe" x={G.globe[0]} y={G.globe[1]} s={24} />
      <text x={G.netLabel[0]} y={G.netLabel[1]} className="s-lab">
        {m.net}
      </text>
      <text x={G.netTally[0]} y={G.netTally[1]} className="s-lab">
        {m.tallies.dropped(sim.dropped)}
      </text>

      {/* la otra máquina de la red */}
      <path d={G.lan.d} className="s-deadline" />
      <path
        d={G.lan.d}
        className="s-live"
        style={{ strokeDasharray: `${G.lan.dash} ${G.lan.dash}`, strokeDashoffset: open ? 0 : G.lan.dash }}
      />
      <path d={xmark(refusedAt[0], refusedAt[1], 5)} className="s-x" style={shown(!open)} />
      <Glyph name="laptop" x={G.laptop[0]} y={G.laptop[1]} s={24} />
      <text x={G.lanLabel[0]} y={G.lanLabel[1]} className="s-title">
        {m.lan[G.narrow ? 1 : 0]}
      </text>
      <Chip {...G.chip} kind="key" text={G.narrow ? m.chips.leakNarrow : m.chips.leakWide} style={shown(open && sim.leaked > 0)} />
      <Chip {...G.chip} kind="dead" text={m.chips.refused} style={shown(!open)} />
      <text x={G.lanTally[0]} y={G.lanTally[1]} className={open ? "t-key" : "s-lab"}>
        {open ? m.tallies.leaked(sim.leaked) : m.tallies.refused(sim.refused)}
      </text>

      <Drawn pts={rectPts(Mb.x, Mb.y, Mb.w, Mb.h)} seed={501} />
      <text x={Mb.x + 14} y={Mb.y + 24} className="s-title">
        {m.machine}
      </text>
      <Glyph name="server" x={Mb.x + Mb.w - 30} y={Mb.y + 11} />

      <Drawn pts={rectPts(B.x, B.y, B.w, B.h)} seed={502} />
      <text x={B.x + 12} y={B.y + B.h / 2 + 4} className="s-title">
        {m.browser}
      </text>
      <text x={G.browserTally[0]} y={G.browserTally[1]} className="s-lab">
        {m.tallies.served(sim.served)}
      </text>
      <path d={G.toBrowser.d} className="s-link" />

      <Drawn pts={sheetPts(P.x, P.y, P.w, P.h, 12)} seed={503} fold={12} />
      <text x={P.x + 12} y={P.y + 22} className="s-file">
        {m.process}
      </text>
      <path d={`M${P.x + 12} ${P.y + 32}H${P.x + P.w - 12}`} className="s-guide" />
      {m.files.map((file, j) => {
        const y = P.y + 42 + j * 22;
        const isKey = file === m.envFile;
        return (
          <g key={file} className={isKey ? "is-key" : undefined}>
            {isKey && <rect x={P.x + 6} y={y} width={P.w - 12} height={19} rx={3} className="s-keybg" />}
            <text x={P.x + 14} y={y + 14} className="s-file">
              {file}
            </text>
          </g>
        );
      })}
      <path d={`M${G.procLink[0][0]} ${G.procLink[0][1]}L${G.procLink[1][0]} ${G.procLink[1][1]}`} className="s-link" />
      <Node cx={G.port[0]} cy={G.port[1]} r={5.5} />
      <text x={G.bindAt[0]} y={G.bindAt[1]} className="s-hash">
        {m.port(ADDR[mode])}
      </text>

      {/* pedidos y respuestas en vuelo */}
      {dots &&
        sim.dots.map((d) => (
          <circle
            key={d.key}
            cx={d.at[0]}
            cy={d.at[1]}
            r={d.kind === "req" ? 5 : 5.5}
            className={d.kind === "req" ? "s-req" : d.kind === "res" ? "s-res" : "s-pulse"}
            style={STILL}
          />
        ))}
      {sim.flashes.map((x) => (
        <path key={x.key} d={xmark(x.at[0], x.at[1], 7)} className="s-x" style={{ ...STILL, opacity: x.opacity }} />
      ))}
    </svg>
  );
}

/** Figura: quién llega a un puerto según la dirección en la que escucha, con pedidos en vivo */
export function BindScope({ name, wide, label, caption }: FigureProps) {
  const [tl, setTl] = useState<Timeline>([{ t: 0, mode: "open" }]);
  const { t: now, playing, reduced, clock, canvas, toggle } = usePlayClock(START_T);
  const seg = useRef<HTMLDivElement>(null);
  const mode = tl[tl.length - 1].mode;

  function pick(next: Mode) {
    if (next === mode) return;
    setTl((prev) => [...prev, { t: clock.current, mode: next }]);
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
      <div className="seg" role="radiogroup" aria-label={m.bind} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.bindLabel}</span>
        {MODES.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={mode === o}
            tabIndex={mode === o ? 0 : -1}
            data-mode={o}
            className="font-mono"
            onClick={() => pick(o)}
          >
            {ADDR[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} tl={tl} t={now} dots={!reduced} label={label} />
        <Scene G={NARROW} tl={tl} t={now} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <button type="button" className="plain" aria-pressed={playing} onClick={toggle}>
          {playing ? `⏸ ${m.pause}` : `▶ ${m.play}`}
        </button>
        <p className="fig-result" aria-live="polite">
          {rich(m.results[mode])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

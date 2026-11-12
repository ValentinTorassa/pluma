"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame } from "./ink";
import { prefersReducedMotion } from "./motion";
import { FigureFrame, Marks, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";

const m = copy.figures.blackiceDia;

export type View = "hora" | "tipo";
export const VIEWS: View[] = ["hora", "tipo"];

export type Group = keyof typeof m.groups;
export const GROUPS: Group[] = ["tele", "apple", "ia", "curl", "otras"];

/**
 * Respuestas de Claude Code como agente de blackice (0.4.5) en la Mac del
 * autor, del jueves 5/11/2026 a las 9:40 al viernes 6/11 a las 9:40, hora
 * argentina, por hora de reloj: la primera hora es de 9:40 a 10 y la última de
 * 9 a 9:40. Contadas de ~/Library/Logs/blackice/events.jsonl (hook_answer del
 * hook de Claude Code), que tiene 107 de las 108 negativas de la evidencia P5-10.
 */
export const APPROVED = [0, 0, 0, 0, 0, 0, 5, 13, 4, 26, 23, 15, 28, 13, 23, 14, 16, 3, 6, 7, 7, 5, 6, 8, 20];
/** Negativas por grupo y hora. `cc`: las de Claude Code a Datadog, que son parte de la telemetría */
export const DENIED: Record<"cc" | Group, number[]> = {
  cc: [0, 0, 0, 0, 0, 0, 0, 3, 3, 5, 2, 5, 4, 2, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 2],
  tele: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  apple: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 6, 3, 3, 2, 1, 0, 0, 1, 1, 0, 0, 1],
  ia: [0, 0, 0, 0, 0, 0, 0, 0, 4, 1, 4, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  curl: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 6, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1],
  otras: [0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
};
export const BINS = APPROVED.length;
/** La primera hora de la ventana empieza a las 9 (9:40); a partir de la 15 es viernes */
const FIRST_HOUR = 9;
const FRIDAY = 24 - FIRST_HOUR;

export const binHour = (i: number) => (FIRST_HOUR + i) % 24;
export const deniedIn = (i: number) => (Object.keys(DENIED) as ("cc" | Group)[]).reduce((n, k) => n + DENIED[k][i], 0);
export const groupTotal = (g: Group) => DENIED[g].reduce((a, b) => a + b, 0) + (g === "tele" ? DENIED.cc.reduce((a, b) => a + b, 0) : 0);
const CC = DENIED.cc.reduce((a, b) => a + b, 0);

/** El rótulo de una hora: «jue 5/11, de 17 a 18 h» */
export function when(i: number): string {
  const h = binHour(i);
  const from = i === 0 ? `${h}:40` : String(h);
  const to = i === BINS - 1 ? `${h}:40` : String((h + 1) % 24);
  return m.when(i < FRIDAY ? m.days.thu : m.days.fri, from, to);
}

export type Dot = {
  ok: boolean;
  bin: number;
  /** Posición en la pila de su hora: primero las aprobadas, arriba las negadas */
  j: number;
  group: Group | null;
  /** Posición en la fila de su grupo; en telemetría van primero las 33 de Claude Code */
  g: number;
};

/** Un punto por respuesta, siempre en el mismo orden (las keys de React no cambian) */
export const DOTS: Dot[] = (() => {
  const out: Dot[] = [];
  const next: Record<Group, number> = { tele: CC, apple: 0, ia: 0, curl: 0, otras: 0 };
  let cc = 0;
  for (let bin = 0; bin < BINS; bin++) {
    let j = 0;
    for (let k = 0; k < APPROVED[bin]; k++) out.push({ ok: true, bin, j: j++, group: null, g: 0 });
    for (const key of ["cc", ...GROUPS] as const) {
      for (let k = 0; k < DENIED[key][bin]; k++) {
        const group: Group = key === "cc" ? "tele" : key;
        out.push({ ok: false, bin, j: j++, group, g: key === "cc" ? cc++ : next[group]++ });
      }
    }
  }
  return out;
})();

/* ---------- dibujo ---------- */

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  /** Borde izquierdo de la primera hora, ancho de cada hora y puntos por renglón */
  x0: number;
  bw: number;
  per: number;
  p: number;
  r: number;
  base: number;
  tickY: number;
  dayY: number;
  /** Cada cuántas horas va un rótulo */
  every: number;
  legend: { x: number; y: number };
  /** Una fila por grupo en la vista por tipo */
  row: (k: number) => { lx: number; ly: number; anchor: "start" | "end"; dx: number; dy: number; sub: "below" | "inline" };
  pt: number;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 222,
  x0: 46,
  bw: 26,
  per: 3,
  p: 7,
  r: 2.6,
  base: 172,
  tickY: 192,
  dayY: 210,
  every: 3,
  legend: { x: 46, y: 14 },
  row: (k) => ({ lx: 200, ly: 58 + k * 34, anchor: "end", dx: 218, dy: 54 + k * 34, sub: "below" }),
  pt: 10,
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 226,
  x0: 15,
  bw: 14,
  per: 2,
  p: 6,
  r: 2.2,
  base: 178,
  tickY: 196,
  dayY: 213,
  every: 6,
  legend: { x: 15, y: 14 },
  row: (k) => ({ lx: 4, ly: 46 + k * 38, anchor: "start", dx: 8, dy: 59 + k * 38, sub: "inline" }),
  pt: 8.6,
};

/** Centro del punto en cada vista */
function place(G: Geo, d: Dot, view: View): [number, number] {
  if (view === "tipo" && d.group) {
    const r = G.row(GROUPS.indexOf(d.group));
    return [r.dx + d.g * G.pt, r.dy];
  }
  return [G.x0 + d.bin * G.bw + (d.j % G.per) * G.p + G.p / 2, G.base - Math.floor(d.j / G.per) * G.p - G.p / 2];
}

type Focus = { kind: "bin"; i: number } | { kind: "group"; g: Group } | null;

function Scene({
  G,
  view,
  shown,
  still,
  focus,
  onFocus,
  label,
}: {
  G: Geo;
  view: View;
  shown: number;
  still: boolean;
  focus: Focus;
  onFocus: (f: Focus) => void;
  label: string;
}) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const hora = view === "hora";
  const right = G.x0 + BINS * G.bw;
  const fri = G.x0 + FRIDAY * G.bw - (G.bw - G.per * G.p) / 2;
  const vis = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });
  const ticks: number[] = [];
  for (let i = 0; i < BINS; i++) if (binHour(i) % G.every === 0 && i > 0) ticks.push(i);
  const fb = focus?.kind === "bin" ? focus.i : null;
  const fg = focus?.kind === "group" ? focus.g : null;
  const stack = (i: number) => Math.ceil((APPROVED[i] + deniedIn(i)) / G.per);

  return (
    <svg
      className={`ink ${G.narrow ? "geo-n" : "geo-w"}${still ? " still" : ""}`}
      viewBox={viewBox}
      role="img"
      aria-label={label}
      onPointerLeave={() => onFocus(null)}
    >
      <Paper vb={vb} step={20} />

      {/* leyenda */}
      <g className="bd-legend">
        <g style={vis(hora)}>
          <circle cx={G.legend.x + 4} cy={G.legend.y - 4} r={3.5} className="bd-ok" />
          <text x={G.legend.x + 13} y={G.legend.y}>
            {m.approved}
          </text>
        </g>
        <g style={{ transform: tr(hora ? 80 : 0, 0) }}>
          <circle cx={G.legend.x + 4} cy={G.legend.y - 4} r={3.5} className="bd-no" />
          <text x={G.legend.x + 13} y={G.legend.y}>
            {m.denied}
          </text>
        </g>
      </g>

      {/* eje de horas: solo en la vista por hora */}
      <g style={vis(hora)}>
        <path d={`M${G.x0 - 2} ${G.base + 2}H${right}`} className="s-ticks" />
        <path d={`M${fri} ${G.base + 8}V${G.base - 128}`} className="s-guide" />
        {ticks.map((i) => (
          <text key={i} x={G.x0 + i * G.bw} y={G.tickY} textAnchor="middle" className="s-tick">
            {binHour(i)}
          </text>
        ))}
        <text x={G.x0} y={G.dayY} className="s-lab">
          {m.days.thu}
        </text>
        <text x={fri + 4} y={G.dayY} className="s-lab">
          {m.days.fri}
        </text>
      </g>

      {/* la hora elegida */}
      {fb !== null && hora && (
        <rect
          x={G.x0 + fb * G.bw - 3}
          y={G.base - Math.max(1, stack(fb)) * G.p - 4}
          width={G.per * G.p + 6}
          height={Math.max(1, stack(fb)) * G.p + 7}
          rx={3}
          className="s-sel"
          style={{ transition: "none" }}
        />
      )}

      {/* los grupos: solo en la vista por tipo */}
      {GROUPS.map((g, k) => {
        const r = G.row(k);
        const sub = m.groups[g].sub;
        return (
          <g key={g} style={vis(!hora)} className={fg && fg !== g ? "bd-row dim" : "bd-row"}>
            <text x={r.lx} y={r.ly} textAnchor={r.anchor} className="s-title">
              {m.groups[g].name}
              <tspan className="bd-count" dx={6}>
                {groupTotal(g)}
              </tspan>
              {sub && r.sub === "inline" && (
                <tspan className="s-lab" dx={6}>
                  {`· ${sub}`}
                </tspan>
              )}
            </text>
            {sub && r.sub === "below" && (
              <text x={r.lx} y={r.ly + 14} textAnchor={r.anchor} className="s-lab">
                {sub}
              </text>
            )}
            {g === "tele" && <path d={`M${r.dx + (CC - 0.5) * G.pt} ${r.dy - 7}v14`} className="s-stem" />}
          </g>
        );
      })}

      {/* un punto por respuesta */}
      {DOTS.map((d, n) => {
        const [x, y] = place(G, d, view);
        const on = d.bin < shown && (hora || !d.ok);
        const dim = (fb !== null && hora && d.bin !== fb) || (fg !== null && !hora && d.group !== fg);
        const style: CSSProperties = {
          transform: tr(x, on ? y : y - 16),
          opacity: on ? (dim ? 0.25 : 1) : 0,
          transitionDelay: still || shown < BINS ? "0ms" : `${d.ok ? 0 : Math.min(d.g, 40) * 6}ms`,
        };
        return <circle key={n} cx={0} cy={0} r={G.r} className={d.ok ? "bd-ok" : "bd-no"} style={style} />;
      })}

      {/* dónde se puede apuntar: una columna por hora, o una fila por grupo */}
      {hora
        ? APPROVED.map((_, i) => (
            <rect
              key={i}
              x={G.x0 + i * G.bw - 2}
              y={24}
              width={G.bw}
              height={G.base - 16}
              className="bd-hit"
              onPointerEnter={() => onFocus({ kind: "bin", i })}
              onClick={() => onFocus({ kind: "bin", i })}
            />
          ))
        : GROUPS.map((g, k) => {
            const r = G.row(k);
            return (
              <rect
                key={g}
                x={0}
                y={r.dy - (G.narrow ? 22 : 17)}
                width={G.W}
                height={G.narrow ? 36 : 34}
                className="bd-hit"
                onPointerEnter={() => onFocus({ kind: "group", g })}
                onClick={() => onFocus({ kind: "group", g })}
              />
            );
          })}
    </svg>
  );
}

function result(view: View, focus: Focus): string {
  const r = m.results;
  if (view === "hora" && focus?.kind === "bin") {
    const no = deniedIn(focus.i);
    const ok = APPROVED[focus.i];
    return ok + no === 0 ? r.empty(when(focus.i)) : r.bin(when(focus.i), ok, no);
  }
  if (view === "tipo" && focus?.kind === "group") return r.groups[focus.g];
  return r[view];
}

const REVEAL_MS = 130;

/** Figura: las 24 horas de respuestas de Claude Code, por hora o con las negativas por tipo */
export function BlackiceDia({ name, wide, label, caption }: FigureProps) {
  const [view, setView] = useState<View>("hora");
  const [focus, setFocus] = useState<Focus>(null);
  const [shown, setShown] = useState(BINS);
  const [still, setStill] = useState(false);
  const raf = useRef(0);
  const seg = useRef<HTMLDivElement>(null);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function pick(next: View) {
    if (next === view) return;
    cancelAnimationFrame(raf.current);
    setShown(BINS);
    setStill(false);
    setFocus(null);
    setView(next);
  }

  function replay() {
    cancelAnimationFrame(raf.current);
    setFocus(null);
    setView("hora");
    if (prefersReducedMotion()) {
      setShown(BINS);
      return;
    }
    // primero vacío y sin transición; después entran las horas de a una
    setStill(true);
    setShown(0);
    const t0 = performance.now();
    const tick = (now: number) => {
      setStill(false);
      const k = Math.min(BINS, Math.floor((now - t0) / REVEAL_MS));
      setShown(k);
      if (k < BINS) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.view} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.viewLabel}</span>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            tabIndex={view === v ? 0 : -1}
            data-view={v}
            onClick={() => pick(v)}
          >
            {m.views[v]}
          </button>
        ))}
      </div>
      <div className="fig-canvas">
        <Scene G={WIDE} view={view} shown={shown} still={still} focus={focus} onFocus={setFocus} label={label} />
        <Scene G={NARROW} view={view} shown={shown} still={still} focus={focus} onFocus={setFocus} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <p className="fig-result" aria-live="polite">
          {rich(result(view, focus))}
        </p>
        <figcaption className="fig-small">
          {caption && `${caption} `}
          <button type="button" className="plain replay" onClick={replay}>
            {m.replay}
          </button>
        </figcaption>
      </div>
    </FigureFrame>
  );
}

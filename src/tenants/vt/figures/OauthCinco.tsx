"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";

const m = copy.figures.oauthCinco;

export type FallaId = keyof typeof m.fallas;
export type Mode = "attack" | "control";
export const MODES: Mode[] = ["attack", "control"];
type Place = "persona" | "agente" | "control" | "api";
const PLACES: Place[] = ["persona", "agente", "control", "api"];

/**
 * Las cinco fallas en el orden de la nota, y dónde frena el pedido cuando el
 * control está: en el broker y la política (control) o en la API, que rechaza
 * el token que no le corresponde.
 */
export const FALLAS: { id: FallaId; stop: "control" | "api" }[] = [
  { id: "scope", stop: "api" },
  { id: "refresh", stop: "control" },
  { id: "authz", stop: "control" },
  { id: "deputy", stop: "api" },
  { id: "silent", stop: "control" },
];

export type End = "api-in" | "api-stop" | "control-stop";

/** Hasta dónde llega el pedido y qué dijo el laboratorio. Sin el control, siempre llega a la API. */
export function outcome(id: FallaId, mode: Mode): { end: End; lines: readonly string[] } {
  const falla = FALLAS.find((f) => f.id === id);
  if (!falla) throw new Error(`falla desconocida: ${id}`);
  const end: End = mode === "attack" ? "api-in" : falla.stop === "api" ? "api-stop" : "control-stop";
  return { end, lines: m.fallas[id][mode].lines };
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Anchor = "middle" | "start";
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  box: Record<Place, Box>;
  /** Texto de cada caja: centrado (ancha) o a la izquierda (angosta) */
  text: (b: Box) => { x: number; anchor: Anchor };
  links: { a: Pt; b: Pt; at: Pt; anchor: Anchor; key: keyof typeof m.links }[];
  /** El pedido: de dónde sale y dónde termina; la × va un poco más adelante */
  dot: Record<"start" | End, Pt>;
  cross: Record<"control" | "api", Pt>;
  mark: Record<FallaId, Pt>;
  tag: Record<FallaId, { x: number; y: number; anchor: Anchor }>;
  envelope: Pt | null;
  out: { rule: number; label: number; first: number; gap: number };
};

const BOX = { w: 128, h: 56, y: 86 };
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 264,
  box: {
    persona: { x: 0, ...BOX },
    agente: { x: 197, ...BOX },
    control: { x: 395, ...BOX },
    api: { x: 592, ...BOX },
  },
  text: (b) => ({ x: b.x + b.w / 2, anchor: "middle" }),
  links: [
    { a: [128, 114], b: [197, 114], at: [162, 103], anchor: "middle", key: "consent" },
    { a: [325, 114], b: [395, 114], at: [360, 103], anchor: "middle", key: "ask" },
    { a: [523, 114], b: [592, 114], at: [557, 103], anchor: "middle", key: "token" },
  ],
  dot: { start: [331, 114], "control-stop": [376, 114], "api-stop": [573, 114], "api-in": [592, 114] },
  cross: { control: [386, 114], api: [583, 114] },
  mark: { scope: [557, 70], refresh: [360, 168], authz: [720, 87], deputy: [299, 42], silent: [523, 87] },
  tag: {
    scope: { x: 557, y: 46, anchor: "middle" },
    refresh: { x: 261, y: 168, anchor: "middle" },
    authz: { x: 656, y: 168, anchor: "middle" },
    deputy: { x: 261, y: 14, anchor: "middle" },
    silent: { x: 459, y: 168, anchor: "middle" },
  },
  envelope: [239, 30],
  out: { rule: 198, label: 220, first: 242, gap: 18 },
};

const NB = { x: 0, w: 170, h: 52 };
const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 448,
  box: {
    persona: { y: 0, ...NB },
    agente: { y: 96, ...NB },
    control: { y: 192, ...NB },
    api: { y: 288, ...NB },
  },
  text: (b) => ({ x: b.x + 12, anchor: "start" }),
  links: [
    { a: [150, 52], b: [150, 96], at: [160, 78], anchor: "start", key: "consent" },
    { a: [150, 148], b: [150, 192], at: [160, 174], anchor: "start", key: "ask" },
    { a: [150, 244], b: [150, 288], at: [160, 270], anchor: "start", key: "token" },
  ],
  dot: { start: [150, 154], "control-stop": [150, 170], "api-stop": [150, 266], "api-in": [150, 306] },
  cross: { control: [150, 181], api: [150, 277] },
  mark: { scope: [236, 266], refresh: [236, 136], authz: [236, 314], deputy: [236, 108], silent: [236, 218] },
  tag: {
    scope: { x: 250, y: 266, anchor: "start" },
    refresh: { x: 250, y: 136, anchor: "start" },
    authz: { x: 250, y: 314, anchor: "start" },
    deputy: { x: 250, y: 108, anchor: "start" },
    silent: { x: 250, y: 218, anchor: "start" },
  },
  envelope: null,
  out: { rule: 362, label: 382, first: 404, gap: 18 },
};

const SEEDS: Record<Place, number> = { persona: 1501, agente: 1502, control: 1503, api: 1504 };
/** Ancho aproximado de un renglón en mono de 10,5 px */
export const tagWidth = (text: string) => Math.round(text.length * 6.4 + 14);

type Phase = "start" | "go";
/** Lo que aparece cuando el pedido llega o lo frenan: después del viaje */
const after = (phase: Phase, on: boolean, delay: number): CSSProperties => ({
  opacity: phase === "go" && on ? 1 : 0,
  transitionDelay: phase === "go" && on ? `${delay}s` : "0s",
});

function Tag({ x, y, anchor, text, mode }: { x: number; y: number; anchor: Anchor; text: string; mode: Mode }) {
  const w = tagWidth(text);
  const left = anchor === "middle" ? x - w / 2 : x;
  return (
    <g className={`oc-tag ${mode}`}>
      <rect x={left} y={y - 9} width={w} height={18} rx={4} />
      <text x={left + w / 2} y={y + 4} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function Scene({ G, index, mode, phase, label }: { G: Geo; index: number; mode: Mode; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { id } = FALLAS[index];
  const res = outcome(id, mode);
  const entry = m.fallas[id][mode];
  const lines = G.narrow && "narrow" in entry ? entry.narrow : res.lines;
  const dot = G.dot[phase === "start" ? "start" : res.end];
  const crossAt = res.end === "control-stop" ? G.cross.control : res.end === "api-stop" ? G.cross.api : null;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* la cadena de la charla */}
      {G.links.map((l) => (
        <g key={l.key}>
          <path d={`M${l.a[0]} ${l.a[1]}L${l.b[0]} ${l.b[1]}`} className="s-ink-thin" />
          <text x={l.at[0]} y={l.at[1]} textAnchor={l.anchor} className="s-lab">
            {m.links[l.key]}
          </text>
        </g>
      ))}

      {PLACES.map((p) => {
        const b = G.box[p];
        const t = G.text(b);
        const ghost = p === "control" && mode === "attack";
        const node = m.nodes[p];
        return (
          <g key={p}>
            <g style={{ opacity: ghost ? 0 : 1 }}>
              <Drawn pts={rectPts(b.x, b.y, b.w, b.h)} seed={SEEDS[p]} />
            </g>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} className="oc-ghost" style={{ opacity: ghost ? 1 : 0 }} />
            <text x={t.x} y={b.y + b.h / 2 - 2} textAnchor={t.anchor} className="s-title">
              {node.name}
            </text>
            <text x={t.x} y={b.y + b.h / 2 + 15} textAnchor={t.anchor} className="oc-sub">
              {ghost && "off" in node ? node.off : node.sub}
            </text>
          </g>
        );
      })}

      {/* el mail con la orden escondida (falla 4) */}
      {G.envelope && (
        <g style={{ opacity: id === "deputy" ? 1 : 0 }}>
          <rect x={G.envelope[0]} y={G.envelope[1]} width={44} height={26} rx={2} className="oc-env" />
          <path
            d={`M${G.envelope[0]} ${G.envelope[1]}L${G.envelope[0] + 22} ${G.envelope[1] + 14}L${G.envelope[0] + 44} ${G.envelope[1]}`}
            className="oc-env"
          />
        </g>
      )}

      {/* la etiqueta de la falla actual */}
      {FALLAS.map((f) => {
        const tg = G.tag[f.id];
        return (
          <g key={f.id} style={{ opacity: f.id === id ? 1 : 0 }}>
            <Tag x={tg.x} y={tg.y} anchor={tg.anchor} text={m.fallas[f.id].tag[mode]} mode={mode} />
          </g>
        );
      })}

      {/* las cinco marcas: la actual en color, las demás tenues */}
      {FALLAS.map((f, i) => {
        const [x, y] = G.mark[f.id];
        return (
          <g key={f.id} className={i === index ? `oc-mark on ${mode}` : "oc-mark"}>
            <circle cx={x} cy={y} r={9} />
            <text x={x} y={y + 4} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* el pedido: sale del agente y llega a la API, o lo frenan */}
      <g className={phase === "start" ? "snap" : undefined} style={{ transform: tr(dot[0], dot[1]) }}>
        <circle cx={0} cy={0} r={6} className={mode === "attack" ? "oc-dot bad" : "oc-dot"} />
      </g>
      {crossAt && <path d={xmark(crossAt[0], crossAt[1], 6)} className="s-x-bad" style={after(phase, true, 0.7)} />}

      {/* lo que dijo el laboratorio */}
      <path d={`M0 ${G.out.rule}H${G.W}`} className="s-guide" />
      <text x={0} y={G.out.label} className="s-lab">
        {m.out}
      </text>
      {lines.map((line, n) => (
        <text
          key={`${id}-${mode}-${n}`}
          x={0}
          y={G.out.first + n * G.out.gap}
          className={mode === "attack" ? "oc-out bad" : "oc-out ok"}
          style={after(phase, true, 0.55 + n * 0.12)}
        >
          {line}
        </text>
      ))}
    </svg>
  );
}

/** Figura: las cinco fallas de OAuth con agentes, una por paso, sin y con el control que la cierra */
export function OauthCinco({ name, wide, label, caption }: FigureProps) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("attack");
  // el cuadro inicial ya muestra el resultado; cada cambio vuelve a mandar el pedido
  const [phase, setPhase] = useState<Phase>("go");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seg = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function replay() {
    clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setPhase("go");
      return;
    }
    setPhase("start");
    timer.current = setTimeout(() => setPhase("go"), 60);
  }

  function go(i: number) {
    setIndex(i);
    replay();
  }

  function pick(next: Mode) {
    if (next === mode) return;
    setMode(next);
    replay();
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  const falla = m.fallas[FALLAS[index].id];

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
        <Scene G={WIDE} index={index} mode={mode} phase={phase} label={label} />
        <Scene G={NARROW} index={index} mode={mode} phase={phase} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <Stepper count={FALLAS.length} index={index} label={rich(m.step(falla.title, falla[mode].text))} onChange={go} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

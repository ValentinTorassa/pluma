"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, SelBox, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.selfDisable;

export type Version = "v03" | "v04";
const VERSIONS: Version[] = ["v03", "v04"];

/* ---------- simulación ---------- */

/** Del agente al hook, y del hook al archivo */
const T_IN = 0.8;
const T_OUT = 0.8;
/** Sesión N: el agente crea settings.local.json */
const W_DEC = T_IN;
const W_LAND = W_DEC + T_OUT;
/** Arranca la sesión N+1: el host lee su configuración */
const SWITCH = 2.3;
const PULSE = 0.7;
const HOOK_OFF = SWITCH + PULSE;
/** Sesión N+1: cat .env */
const R_SEND = 3.4;
const R_DEC = R_SEND + T_IN;
const R_LAND = R_DEC + T_OUT;
const CHECK = 0.6;
const FADE = 0.35;
export const SD_END = R_LAND + 0.5;
/** El cuadro inicial: el archivo ya quedó escrito y la sesión N+1 todavía no arrancó */
export const SD_START = 1.9;

export type SdChip = { key: "w" | "r"; seg: "in" | "out"; target: "settings" | "env"; p: number; opacity: number };
export type SdFrame = {
  chips: SdChip[];
  /** ✓ y × en el hook (0 = no se ven) */
  check: number;
  hit: number;
  decision: "allow" | "fs" | "sh" | null;
  settings: "absent" | "written";
  session: "n" | "next";
  /** Avance de la lectura de la configuración al arrancar la sesión N+1 */
  pulse: number | null;
  hookOn: boolean;
  envRead: boolean;
  phase: "write" | "decided" | "session" | "read";
  done: boolean;
};

/**
 * Qué pasa en el segundo `t`. En 0.3.0 la escritura se permite, la sesión
 * siguiente arranca sin hook y cat .env pasa derecho; en 0.4.0 el hook
 * protege su configuración aunque no exista y sigue ahí. Función pura del tiempo.
 */
export function simulateSelfDisable(v: Version, t: number): SdFrame {
  const v04 = v === "v04";
  const f: SdFrame = {
    chips: [],
    check: 0,
    hit: 0,
    decision: null,
    settings: !v04 && t >= W_LAND ? "written" : "absent",
    session: t >= SWITCH ? "next" : "n",
    pulse: t >= SWITCH && t < SWITCH + PULSE ? (t - SWITCH) / PULSE : null,
    hookOn: v04 || t < HOOK_OFF,
    envRead: !v04 && t >= R_LAND,
    phase: t < W_DEC ? "write" : t < SWITCH ? "decided" : t < R_SEND ? "session" : "read",
    done: t >= SD_END,
  };

  // sesión N: Write .claude/settings.local.json
  if (t >= 0 && t < W_DEC) f.chips.push({ key: "w", seg: "in", target: "settings", p: t / T_IN, opacity: 1 });
  if (t >= W_DEC && t < SWITCH) f.decision = v04 ? "fs" : "allow";
  if (t >= W_DEC && !v04) {
    if (t < W_LAND) f.chips.push({ key: "w", seg: "out", target: "settings", p: (t - W_DEC) / T_OUT, opacity: 1 });
    if (t < W_DEC + CHECK) f.check = 1 - (t - W_DEC) / CHECK;
  }
  if (t >= W_DEC && v04) {
    if (t < W_DEC + FADE) f.chips.push({ key: "w", seg: "in", target: "settings", p: 1, opacity: 1 - (t - W_DEC) / FADE });
    if (t < W_DEC + FLASH) f.hit = 1 - (t - W_DEC) / FLASH;
  }

  // sesión N+1: cat .env, con o sin hook en el medio
  if (t >= R_SEND && t < R_DEC) f.chips.push({ key: "r", seg: "in", target: "env", p: (t - R_SEND) / T_IN, opacity: 1 });
  if (t >= R_DEC && !v04 && t < R_LAND) f.chips.push({ key: "r", seg: "out", target: "env", p: (t - R_DEC) / T_OUT, opacity: 1 });
  if (t >= R_DEC && v04) {
    f.decision = "sh";
    if (t < R_DEC + FADE) f.chips.push({ key: "r", seg: "in", target: "env", p: 1, opacity: 1 - (t - R_DEC) / FADE });
    if (t < R_DEC + FLASH) f.hit = 1 - (t - R_DEC) / FLASH;
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
  sessionAt: Pt;
  agent: Box;
  hook: Box;
  hookTitle: Pt;
  hookSub: Pt;
  decisionAt: Pt;
  offChip: Box;
  link: [Pt, Pt];
  /** Donde arranca la ficha y donde decide el hook */
  start: Pt;
  dec: Pt;
  checkAt: Pt;
  toSettings: Cubic;
  toEnv: Cubic;
  /** Cuánto antes del archivo se detiene la ficha */
  short: number;
  host: Cubic;
  hostLabel: Pt | null;
  settings: Box;
  env: Box;
  /** Dónde va el rótulo "creado" / "leído" de cada hoja */
  mark: (b: Box) => { at: Pt; anchor: "start" | "end" };
  /** Fila del contenido de cada hoja */
  row: (b: Box) => number;
  envValue: string;
};

const line = (a: Pt, b: Pt) => cubic(a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b);

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 230,
  sessionAt: [0, 66],
  agent: { x: 0, y: 80, w: 110, h: 60 },
  hook: { x: 200, y: 50, w: 170, h: 120 },
  hookTitle: [212, 74],
  hookSub: [212, 92],
  decisionAt: [212, 156],
  offChip: { x: 212, y: 140, w: 96, h: 24 },
  link: [
    [110, 110],
    [285, 110],
  ],
  start: [150, 110],
  dec: [285, 110],
  checkAt: [279, 122],
  toSettings: cubic([285, 110], [410, 110], [400, 64], [470, 64]),
  toEnv: cubic([285, 110], [410, 110], [400, 176], [470, 176]),
  short: 42,
  host: cubic([470, 26], [420, 26], [330, 30], [330, 50]),
  hostLabel: [378, 16],
  settings: { x: 470, y: 8, w: 250, h: 84 },
  env: { x: 470, y: 140, w: 250, h: 84 },
  mark: (b) => ({ at: [b.x + b.w - 14, b.y + b.h - 8], anchor: "end" }),
  row: (b) => b.y + 58,
  envValue: m.envValue,
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 366,
  sessionAt: [0, 12],
  agent: { x: 0, y: 22, w: 150, h: 56 },
  hook: { x: 0, y: 124, w: 380, h: 96 },
  hookTitle: [124, 148],
  hookSub: [124, 166],
  decisionAt: [124, 204],
  offChip: { x: 124, y: 188, w: 96, h: 24 },
  link: [
    [60, 78],
    [60, 172],
  ],
  start: [60, 100],
  dec: [60, 172],
  checkAt: [70, 180],
  toSettings: line([60, 172], [60, 288]),
  toEnv: cubic([60, 172], [60, 250], [310, 236], [310, 288]),
  short: 14,
  host: line([20, 288], [20, 220]),
  hostLabel: null,
  settings: { x: 0, y: 288, w: 220, h: 76 },
  env: { x: 240, y: 288, w: 140, h: 76 },
  mark: (b) => ({ at: [b.x + 12, b.y + 66], anchor: "start" }),
  row: (b) => b.y + 48,
  envValue: m.envValueNarrow,
};

const CHAR = 7.2;
const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Chip({ at, text, opacity }: { at: Pt; text: string; opacity: number }) {
  const w = text.length * CHAR + 16;
  const h = 20;
  return (
    <g style={{ ...STILL, opacity, transform: tr(at[0] - w / 2, at[1] - h / 2) }}>
      <rect width={w} height={h} rx={4} className="s-fill" style={STILL} />
      <rect width={w} height={h} rx={4} className="s-tag-ink" style={STILL} />
      <text x={8} y={14} className="t-ink" style={STILL}>
        {text}
      </text>
    </g>
  );
}

function Tag({ box, kind, text, on }: { box: Box; kind: "dead" | "ink"; text: string; on: boolean }) {
  return (
    <g style={shown(on)}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} className={`s-tag-${kind}`} />
      <text x={box.x + 9} y={box.y + box.h / 2 + 4} className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

function Scene({ G, v, f, dots, label }: { G: Geo; v: Version; f: SdFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { agent: A, hook: K, settings: S, env: E } = G;
  const v04 = v === "v04";
  const written = f.settings === "written";
  const place = (c: SdChip): Pt => {
    if (c.seg === "in") return lerp(G.start, G.dec, c.p);
    const route = c.target === "settings" ? G.toSettings : G.toEnv;
    return route.at((route.length - G.short) * c.p);
  };
  const sMark = G.mark(S);
  const eMark = G.mark(E);
  const pulseOn = f.pulse !== null;
  const offset = G.host.dash * (1 - (f.pulse ?? 0));

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* la sesión */}
      <text x={G.sessionAt[0]} y={G.sessionAt[1]} className="s-hash" style={shown(f.session === "n")}>
        {m.sessions.n}
      </text>
      <text x={G.sessionAt[0]} y={G.sessionAt[1]} className="s-hash" style={shown(f.session === "next")}>
        {m.sessions.next}
      </text>

      {/* caminos: al hook y del hook a cada archivo */}
      <path d={`M${G.link[0][0]} ${G.link[0][1]}L${G.link[1][0]} ${G.link[1][1]}`} className="s-link" />
      <path d={G.toSettings.d} className="s-link" />
      <path d={G.toEnv.d} className="s-link" />

      {/* el host lee settings.local.json al arrancar cada sesión */}
      <path d={G.host.d} className="s-guide" />
      <path
        d={G.host.d}
        className={v04 ? "s-link" : "s-live"}
        style={{ ...STILL, strokeDasharray: `${G.host.dash} ${G.host.dash}`, strokeDashoffset: offset, opacity: pulseOn ? 1 : 0 }}
      />
      {G.hostLabel && (
        <text x={G.hostLabel[0]} y={G.hostLabel[1]} className="s-lab">
          {m.hostReads}
        </text>
      )}

      {/* el agente */}
      <Drawn pts={rectPts(A.x, A.y, A.w, A.h)} seed={1201} />
      <text x={A.x + 12} y={A.y + 24} className="s-title">
        {m.agent}
      </text>
      <text x={A.x + 12} y={A.y + 42} className="s-lab">
        {m.agentSub}
      </text>
      <Glyph name="bot" x={A.x + A.w - 26} y={A.y + 10} />

      {/* el hook: en 0.3.0, en la sesión N+1 no se carga */}
      <g style={shown(!f.hookOn)}>
        <SelBox x={K.x} y={K.y} w={K.w} h={K.h} />
      </g>
      <g className={f.hookOn ? undefined : "quick"} style={shown(f.hookOn)}>
        <Drawn pts={rectPts(K.x, K.y, K.w, K.h)} seed={1202} />
        <path d={`M${G.link[0][0]} ${G.link[0][1]}L${G.link[1][0]} ${G.link[1][1]}`} className="s-link" />
        <text x={G.hookTitle[0]} y={G.hookTitle[1]} className="s-hash">
          {m.hook}
        </text>
        <text x={G.hookSub[0]} y={G.hookSub[1]} className="s-lab">
          {m.hookSub}
        </text>
        <Node cx={G.dec[0]} cy={G.dec[1]} r={4.5} />
      </g>
      {(["allow", "fs", "sh"] as const).map((d) => (
        <text key={d} x={G.decisionAt[0]} y={G.decisionAt[1]} className="sd-dec" style={shown(f.decision === d)}>
          {m.decisions[d]}
        </text>
      ))}
      <Tag box={G.offChip} kind="dead" text={m.off} on={!f.hookOn} />

      {/* .claude/settings.local.json: no existe hasta que alguien lo crea */}
      <rect x={S.x} y={S.y} width={S.w} height={S.h} rx={2} className="sd-ghost" style={shown(!written)} />
      <g style={shown(written)}>
        <Drawn pts={sheetPts(S.x, S.y, S.w, S.h, 10)} seed={1203} fold={10} />
      </g>
      <text x={S.x + 14} y={S.y + 22} className="s-file">
        {m.settings}
      </text>
      <text x={S.x + 14} y={G.row(S)} className="s-lab" style={shown(!v04 && !written)}>
        {m.absent}
      </text>
      <text x={S.x + 14} y={G.row(S)} className="sd-safe" style={shown(v04)}>
        {m.guarded}
      </text>
      <g className="is-key" style={shown(written)}>
        <rect x={S.x + 6} y={G.row(S) - 14} width={S.w - 12} height={20} rx={3} className="s-keybg" />
        <text x={S.x + 14} y={G.row(S)} className="s-file">
          {m.written}
        </text>
      </g>
      <text x={sMark.at[0]} y={sMark.at[1]} textAnchor={sMark.anchor} className="t-key" style={shown(written)}>
        {m.created}
      </text>

      {/* .env */}
      <Drawn pts={sheetPts(E.x, E.y, E.w, E.h, 10)} seed={1204} fold={10} />
      <text x={E.x + 14} y={E.y + 22} className="s-file">
        {m.env}
      </text>
      <g className="is-key">
        <rect x={E.x + 6} y={G.row(E) - 14} width={E.w - 12} height={20} rx={3} className="s-keybg" />
        <text x={E.x + 14} y={G.row(E)} className="s-file">
          {G.envValue}
        </text>
      </g>
      <text x={eMark.at[0]} y={eMark.at[1]} textAnchor={eMark.anchor} className="t-key" style={shown(f.envRead)}>
        {m.read}
      </text>

      {/* en vuelo */}
      <g style={{ ...STILL, opacity: f.check }}>
        <Glyph name="check" x={G.checkAt[0]} y={G.checkAt[1]} s={12} />
      </g>
      {dots && f.chips.map((c) => <Chip key={c.key} at={place(c)} text={m.requests[c.key === "w" ? "write" : "read"]} opacity={c.opacity} />)}
      <path d={xmark(G.dec[0], G.dec[1], 8)} className="s-x" style={{ ...STILL, opacity: f.hit }} />
    </svg>
  );
}

function result(v: Version, f: SdFrame) {
  const v04 = v === "v04";
  if (f.done) return m.results[v];
  if (f.phase === "write") return m.results.write;
  if (f.phase === "decided") return v04 ? m.results.refused : m.results.allowed;
  if (f.phase === "session") return v04 ? m.results.sessionOn : m.results.sessionOff;
  return v04 ? m.results.readOn : m.results.readOff;
}

/** Figura: el agente crea la configuración que apaga el hook en la sesión siguiente */
export function SelfDisable({ name, wide, label, caption }: FigureProps) {
  const [v, setV] = useState<Version>("v03");
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(SD_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateSelfDisable(v, Math.min(t, SD_END));

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
        <p className="fig-result" aria-live="polite">
          {rich(result(v, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

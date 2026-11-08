"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, GLYPHS, rectPts, sheetPts, xmark, type Pt } from "./ink";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, SelBox, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, STILL, usePlayClock } from "./sim";

const m = copy.figures.jwtFirma;

export type FirmaMode = "user" | "admin";
const MODES: FirmaMode[] = ["user", "admin"];

/* ---------- el token ---------- */

export const HEADER = m.jwt.header;
export const PAYLOAD: Record<FirmaMode, string> = m.jwt.payload;
/** La firma que trae el token: el cliente no la puede rehacer, así que es la misma en los dos casos */
export const SIGNATURE = m.jwt.signature;
/** La firma que calcula el servidor con su clave sobre el payload que le llega */
export const COMPUTED: Record<FirmaMode, string> = m.jwt.computed;

/** Hasta dónde coinciden los dos payloads en base64url: lo que sigue es lo que cambia */
export const DIFF = (() => {
  const [a, b] = [PAYLOAD.user, PAYLOAD.admin];
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
})();

/** Caracteres de cada firma que muestra el servidor */
export const SHOW = 10;

/* ---------- simulación ---------- */

/** El JSON decodificado cambia primero; después se reescribe el base64url */
const ROLE_AT = 0.15;
const RETYPE = [0.3, 1.3] as const;
/** El token sale hacia el servidor */
export const SEND = 1.6;
const TRAVEL = 1.1;
const ARRIVE = SEND + TRAVEL;
/** El servidor calcula su firma de a un carácter */
const COMPUTE = [ARRIVE + 0.25, ARRIVE + 1.15] as const;
const VERDICT = ARRIVE + 1.35;
const FADE = 0.3;
/** Cuando ya pasó todo; el reloj se detiene ahí */
export const FS_END = VERDICT + 0.9;
/** El cuadro inicial: el token en camino */
export const FS_START = SEND + 0.45 * TRAVEL;

export type Range = readonly [number, number];
export type FirmaFrame = {
  /** El payload en base64url tal como se ve en este momento */
  payload: string;
  /** Tramos del payload que ya no son los que firmó el servidor */
  changed: Range[];
  /** Dónde está escribiendo, mientras se reescribe el payload */
  caret: number | null;
  /** El rol que muestra el payload decodificado */
  role: FirmaMode;
  /** Avance del token hacia el servidor (0 a 1), o null si no está en camino */
  dot: number | null;
  received: boolean;
  /** Cuántos caracteres de la firma calculada ya se ven */
  computed: number;
  /** Opacidad del veredicto */
  verdict: number;
  match: boolean;
  server: "waiting" | "checking" | "accepted" | "rejected";
  phase: "edit" | "sending" | "checking" | "done";
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * El token con el payload de `mode` viaja al servidor, que recalcula la firma
 * y la compara con la que trae. Si se acaba de cambiar desde `from`, primero
 * se reescribe el payload. Función pura del tiempo.
 */
export function simulateFirma(mode: FirmaMode, t: number, from: FirmaMode | null = null): FirmaFrame {
  const editing = from !== null && from !== mode;
  const target = PAYLOAD[mode];
  let payload = target;
  let split = target.length;
  let caret: number | null = null;

  if (editing) {
    const old = PAYLOAD[from];
    const n = Math.max(target.length, old.length) - DIFF;
    const k = Math.round(clamp01((t - RETYPE[0]) / (RETYPE[1] - RETYPE[0])) * n);
    split = Math.min(DIFF + k, target.length);
    payload = target.slice(0, DIFF + k) + old.slice(DIFF + k);
    if (t >= RETYPE[0] && t < RETYPE[1]) caret = split;
  }

  const changed: Range[] = [];
  if (mode === "admin" && split > DIFF) changed.push([DIFF, split]);
  if (editing && from === "admin" && split < payload.length) changed.push([split, payload.length]);

  const match = COMPUTED[mode] === SIGNATURE;
  const f: FirmaFrame = {
    payload,
    changed,
    caret,
    role: editing && t < ROLE_AT ? (from as FirmaMode) : mode,
    dot: t >= SEND && t < ARRIVE ? (t - SEND) / TRAVEL : null,
    received: t >= ARRIVE,
    computed: Math.floor(clamp01((t - COMPUTE[0]) / (COMPUTE[1] - COMPUTE[0])) * SHOW),
    verdict: clamp01((t - VERDICT) / FADE),
    match,
    server: t < ARRIVE ? "waiting" : t < VERDICT ? "checking" : match ? "accepted" : "rejected",
    phase: editing && t < SEND ? "edit" : t < ARRIVE ? "sending" : t < VERDICT ? "checking" : "done",
  };
  return f;
}

/** Un tramo de un renglón del token, con su color */
export type Run = { cls: "h" | "p" | "pc" | "s" | "dot"; text: string; col: number };

/**
 * El token en renglones de `cols` caracteres. Cada parte empieza en su propio
 * renglón, así la firma queda siempre en el mismo lugar.
 */
export function tokenRows(payload: string, changed: Range[], cols: number): Run[][] {
  const rows: Run[][] = [];
  const part = (text: string, kind: (i: number) => Run["cls"]) => {
    for (let r = 0; r * cols < text.length; r++) {
      const row: Run[] = [];
      for (let c = 0; c < cols && r * cols + c < text.length; c++) {
        const i = r * cols + c;
        const cls = kind(i);
        const last = row[row.length - 1];
        if (last && last.cls === cls) last.text += text[i];
        else row.push({ cls, text: text[i], col: c });
      }
      rows.push(row);
    }
  };
  part(`${HEADER}.`, (i) => (i < HEADER.length ? "h" : "dot"));
  part(`${payload}.`, (i) => (i >= payload.length ? "dot" : changed.some(([a, b]) => i >= a && i < b) ? "pc" : "p"));
  part(SIGNATURE, () => "s");
  return rows;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  card: Box;
  /** Segunda columna del payload decodificado */
  col2: number;
  server: Box;
  /** Tamaño de la letra del token y del payload decodificado, con su ancho de carácter (mono) y su interlínea */
  fs: number;
  cw: number;
  lh: number;
  jfs: number;
  jcw: number;
  jlh: number;
  /** Columna de los valores de las firmas, y de la marca del veredicto */
  valueX: number;
  markX: number;
  cable: [Pt, Pt];
  tag: Pt;
  tagAnchor: "middle" | "start";
};

/** Caracteres por renglón del token */
const COLS = 44;
/** Dentro de la hoja del token y de la caja del servidor, todo se mide desde la esquina */
const PAD = 14;
const ROW0 = 72;
/** Aire extra entre el header, el payload y la firma */
const PART_GAP = 4;
/** Ancho de un carácter de IBM Plex Mono: 0.6 em */
const MONO = 0.6;

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 254,
  card: { x: 0, y: 0, w: 318, h: 254 },
  col2: 180,
  fs: 11,
  cw: 11 * MONO,
  lh: 17,
  jfs: 11,
  jcw: 11 * MONO,
  jlh: 16,
  server: { x: 438, y: 28, w: 282, h: 198 },
  valueX: 114,
  markX: 204,
  cable: [
    [318, 127],
    [438, 127],
  ],
  tag: [0, -12],
  tagAnchor: "middle",
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 526,
  card: { x: 0, y: 0, w: 380, h: 270 },
  col2: 196,
  fs: 12.5,
  cw: 12.5 * MONO,
  lh: 19,
  jfs: 12,
  jcw: 12 * MONO,
  jlh: 18,
  server: { x: 0, y: 332, w: 380, h: 194 },
  valueX: 116,
  markX: 206,
  cable: [
    [190, 270],
    [190, 332],
  ],
  tag: [14, 4],
  tagAnchor: "start",
};

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });
const chipWidth = (text: string) => text.length * 7.2 + 20;

function Chip({ x, y, kind, text, on }: { x: number; y: number; kind: "ink" | "dead" | "safe" | "key"; text: string; on: boolean }) {
  return (
    <g style={shown(on)}>
      <rect x={x} y={y} width={chipWidth(text)} height={26} rx={4} className={`s-tag-${kind}`} />
      <text x={x + 10} y={y + 17} className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

function Scene({ G, mode, f, dots, label }: { G: Geo; mode: FirmaMode; f: FirmaFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const C = G.card;
  const S = G.server;
  const cx = C.x + PAD;
  const sx = S.x + PAD;
  const rows = tokenRows(f.payload, f.changed, COLS);
  const { cw, lh, jcw, jlh } = G;
  const sigRow = rows.length - 1;
  const rowY = (r: number) => C.y + ROW0 + r * lh + (r === 0 ? 0 : r === sigRow ? 2 : 1) * PART_GAP;
  const admin = mode === "admin";
  const decodedY = rowY(sigRow) + 44;
  const jsonY = (k: number) => decodedY + 18 + k * jlh;
  const roleX = cx + 10 + m.claims.role.length * jcw;
  const tok = { fontSize: G.fs };
  const json = { fontSize: G.jfs };

  // dónde está escribiendo: el payload empieza en el segundo renglón
  const caretAt = f.caret === null ? null : { r: 1 + Math.floor(f.caret / COLS), c: f.caret % COLS };
  const tagAt = f.dot === null ? null : lerp(G.cable[0], G.cable[1], f.dot);
  // en la figura ancha la etiqueta del token aparece y se va en las puntas del cable
  const tagOpacity = f.dot === null ? 0 : G.narrow ? 1 : clamp01(Math.min(f.dot, 1 - f.dot) / 0.15);

  const sigShort = `${SIGNATURE.slice(0, SHOW)}${m.more}`;
  const computed = COMPUTED[mode].slice(0, f.computed) + (f.computed >= SHOW ? m.more : "");
  const computedCls = f.verdict > 0 ? (f.match ? "jw-sig jw-ok" : "jw-sig jw-bad") : "jw-sig";
  const rowA = S.y + 104;
  const rowB = S.y + 126;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* cable */}
      <path d={`M${G.cable[0][0]} ${G.cable[0][1]}L${G.cable[1][0]} ${G.cable[1][1]}`} className="s-link" />
      <Node cx={G.cable[1][0]} cy={G.cable[1][1]} r={4.5} />

      {/* el token, en la mano del cliente */}
      <Drawn pts={sheetPts(C.x, C.y, C.w, C.h, 12)} seed={1101} fold={12} />
      <text x={cx} y={C.y + 26} className="s-title">
        {m.token}
        <tspan className="s-lab" dx={8}>
          {m.tokenSub[mode]}
        </tspan>
      </text>
      <text x={cx} y={C.y + 46} className="jw-legend">
        <tspan className="jw-h">{m.parts.header}</tspan>
        <tspan className="jw-sep">{m.partsDot}</tspan>
        <tspan className="jw-p">{m.parts.payload}</tspan>
        <tspan className="jw-sep">{m.partsDot}</tspan>
        <tspan className="jw-s">{m.parts.signature}</tspan>
      </text>

      {/* lo que ya no es lo que firmó el servidor, resaltado */}
      {rows.map((row, r) =>
        row
          .filter((run) => run.cls === "pc")
          .map((run) => (
            <rect
              key={`bg-${r}-${run.col}`}
              x={cx + run.col * cw - 1}
              y={rowY(r) - G.fs + 0.5}
              width={run.text.length * cw + 2}
              height={G.fs + 3}
              rx={2}
              className="jw-chg-bg"
              style={STILL}
            />
          )),
      )}
      {rows.map((row, r) => (
        <text key={r} x={cx} y={rowY(r)} className="jw-tok" style={{ ...STILL, ...tok }}>
          {row.map((run) => (
            <tspan key={run.col} className={`jw-${run.cls}`}>
              {run.text}
            </tspan>
          ))}
        </text>
      ))}
      {caretAt && (
        <rect x={cx + caretAt.c * cw - 0.75} y={rowY(caretAt.r) - G.fs + 1} width={1.5} height={G.fs + 2} className="jw-caret" style={STILL} />
      )}

      {/* de dónde sale la firma, y que no cambió */}
      <text x={cx} y={rowY(sigRow) + 21} className="s-lab" style={shown(!admin)}>
        {m.issued}
      </text>
      <g style={shown(admin)}>
        <SelBox x={cx - 5} y={rowY(sigRow) - G.fs - 2} w={SIGNATURE.length * cw + 10} h={G.fs + 7} />
        <text x={cx} y={rowY(sigRow) + 21} className="s-lab">
          {m.same}
        </text>
      </g>

      {/* el payload decodificado: cualquiera lo lee */}
      <text x={cx} y={decodedY} className="s-lab">
        {m.decoded}
      </text>
      <path d={`M${cx + 1} ${decodedY + 8}V${jsonY(2) + 4}`} className="s-guide" />
      {f.role === "admin" && (
        <rect x={roleX - 1} y={jsonY(2) - G.jfs + 0.5} width={m.claims.roleValue.admin.length * jcw + 2} height={G.jfs + 3} rx={2} className="jw-chg-bg" />
      )}
      <text x={cx + 10} y={jsonY(0)} className="jw-json" style={json}>
        {m.claims.sub}
      </text>
      <text x={cx + 10} y={jsonY(1)} className="jw-json" style={json}>
        {m.claims.name}
      </text>
      <text x={cx + 10} y={jsonY(2)} className="jw-json" style={json}>
        {m.claims.role}
        <tspan className={f.role === "admin" ? "jw-pc" : undefined}>{m.claims.roleValue[f.role]}</tspan>
        {m.claims.comma}
      </text>
      <text x={C.x + G.col2} y={jsonY(0)} className="jw-json" style={json}>
        {m.claims.iat}
      </text>
      <text x={C.x + G.col2} y={jsonY(1)} className="jw-json" style={json}>
        {m.claims.exp}
      </text>

      {/* el servidor */}
      <Drawn pts={rectPts(S.x, S.y, S.w, S.h)} seed={1102} />
      <text x={sx} y={S.y + 26} className="s-title">
        {m.server}
      </text>
      <Glyph name="server" x={S.x + S.w - 30} y={S.y + 11} />
      <text x={sx} y={S.y + 52} className="s-lab">
        {m.key}
      </text>
      <Glyph name="key" x={sx + 36} y={S.y + 40} />
      <text x={sx + 58} y={S.y + 52} className="jw-secret">
        {m.secret}
      </text>
      <text x={sx} y={S.y + 76} className="s-lab s-mono jw-small">
        {m.recompute}
      </text>

      <text x={sx} y={rowA} className="s-lab">
        {m.tokenSig}
      </text>
      <text x={sx + G.valueX} y={rowA} className="jw-sig jw-s" style={shown(f.received)}>
        {sigShort}
      </text>
      <text x={sx} y={rowB} className="s-lab">
        {m.computedSig}
      </text>
      <text x={sx + G.valueX} y={rowB} className={computedCls} style={STILL}>
        {computed}
      </text>
      <g style={{ ...STILL, opacity: f.verdict }}>
        {f.match ? (
          <path d={GLYPHS.check[0].d} transform={`translate(${sx + G.markX} ${rowA + 1}) scale(1.1)`} className="jw-mark-ok" />
        ) : (
          <path d={xmark(sx + G.markX + 8, rowA + 11, 6)} className="s-x-bad" />
        )}
      </g>

      <Chip x={sx} y={S.y + 146} kind="dead" text={m.chips.waiting} on={f.server === "waiting"} />
      <Chip x={sx} y={S.y + 146} kind="ink" text={m.chips.checking} on={f.server === "checking"} />
      <Chip x={sx} y={S.y + 146} kind="safe" text={m.chips.accepted} on={f.server === "accepted"} />
      <Chip x={sx} y={S.y + 146} kind="key" text={m.chips.rejected} on={f.server === "rejected"} />

      {/* el token en camino */}
      {dots && tagAt && (
        <g style={STILL}>
          <circle cx={tagAt[0]} cy={tagAt[1]} r={5} className="s-req" style={STILL} />
          <text
            x={tagAt[0] + G.tag[0]}
            y={tagAt[1] + G.tag[1]}
            textAnchor={G.tagAnchor}
            className="wh-row"
            style={{ ...STILL, opacity: tagOpacity }}
          >
            {m.bearer}
          </text>
        </g>
      )}
    </svg>
  );
}

function result(mode: FirmaMode, f: FirmaFrame) {
  if (f.phase === "edit") return m.results.edit[mode];
  if (f.phase === "done") return m.results[mode];
  return m.results[f.phase];
}

/** Figura: el payload de un JWT se lee sin clave, pero si cambia, la firma deja de coincidir */
export function JwtFirma({ name, wide, label, caption }: FigureProps) {
  const [mode, setMode] = useState<FirmaMode>("user");
  /** El modo anterior, para reescribir el payload al cambiarlo (null: nadie lo tocó todavía) */
  const [from, setFrom] = useState<FirmaMode | null>(null);
  const { t, playing, reduced, canvas, play, toggle, reset } = usePlayClock(FS_START);
  const seg = useRef<HTMLDivElement>(null);
  const time = Math.min(t, FS_END);
  const f = simulateFirma(mode, time, from);
  const done = t >= FS_END;

  // al terminar el guion el reloj se detiene
  useEffect(() => {
    if (done && playing) toggle();
  }, [done, playing, toggle]);

  function pick(next: FirmaMode) {
    if (next === mode) return;
    setFrom(mode);
    setMode(next);
    reset(0);
    play();
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  function again() {
    reset(from === null ? FS_START : 0);
    play();
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
            <span className="jw-role">{m.modes[o]}</span>
            <small>{m.modeNotes[o]}</small>
          </button>
        ))}
      </div>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} mode={mode} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} mode={mode} f={f} dots={!reduced} label={label} />
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
        <p className="fig-result" aria-live="polite">
          {rich(result(mode, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

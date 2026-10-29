"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame, fx, poly, rectPts, rng, sketch, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";

const m = copy.figures.egressTripwire;

/* ---------- la búsqueda de secret-egress (agent_firewall/egress.py, 0.4.0) ---------- */

/** Valores más cortos no se buscan */
const MIN_LENGTH = 8;

export type Form = "plain" | "base64" | "hex";
type Spelling = { form: Form; text: string };

const bytesOf = (s: string) => Array.from(new TextEncoder().encode(s));
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const hexOf = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * El valor, su hex y la parte de su base64 que no depende de lo que tenga
 * alrededor en un string codificado más largo (una por offset módulo 3).
 */
export function spellings(value: string): Spelling[] {
  const data = bytesOf(value);
  const out: Spelling[] = [
    { form: "plain", text: value },
    { form: "hex", text: hexOf(data) },
    { form: "hex", text: hexOf(data).toUpperCase() },
  ];
  for (let offset = 0; offset < 3; offset++) {
    const encoded = b64([...new Array<number>(offset).fill(0), ...data]);
    const start = Math.floor((8 * offset + 5) / 6);
    const end = Math.floor((8 * (offset + data.length)) / 6);
    const core = encoded.slice(start, end);
    if (core.length >= MIN_LENGTH) {
      out.push({ form: "base64", text: core });
      out.push({ form: "base64", text: core.replace(/\+/g, "-").replace(/\//g, "_") });
    }
  }
  const unique = out.filter((s, i) => out.findIndex((o) => o.text === s.text) === i);
  return unique.sort((a, b) => b.text.length - a.text.length);
}

/** unquote_plus de Python: `+` es un espacio y una secuencia %XX inválida queda como está */
function unquotePlus(s: string): string {
  return s.replace(/\+/g, " ").replace(/(?:%[0-9a-fA-F]{2})+/g, (seq) => {
    try {
      return decodeURIComponent(seq);
    } catch {
      return seq;
    }
  });
}

export type Match = { form: Form; decoded: boolean; start: number; end: number };

/**
 * Si `text` lleva el valor: tal cual o con el percent-encoding decodificado
 * una y dos veces, en cualquiera de sus formas. `start`/`end` marcan dónde
 * está en `text` (si hubo que decodificar, todo el string).
 */
export function detect(text: string, value: string): Match | null {
  const candidates = [text];
  for (let i = 0; i < 2; i++) {
    const last = candidates[candidates.length - 1];
    const decoded = unquotePlus(last);
    if (decoded !== last) candidates.push(decoded);
  }
  const forms = spellings(value);
  for (const [ci, candidate] of candidates.entries()) {
    for (const s of forms) {
      const at = candidate.indexOf(s.text);
      if (at < 0) continue;
      return ci === 0 ? { form: s.form, decoded: false, start: at, end: at + s.text.length } : { form: s.form, decoded: true, start: 0, end: text.length };
    }
  }
  return null;
}

/* ---------- cómo sale la key ---------- */

export type Preset = "plain" | "percent" | "base64" | "hex" | "split" | "reverse" | "xor";
export const PRESETS: Preset[] = ["plain", "percent", "base64", "hex", "split", "reverse", "xor"];
/** El cuadro inicial: una codificación que el lector no esperaría que reconozca */
export const START: Preset = "base64";
/** Clave del XOR de ejemplo */
const XOR_KEY = bytesOf("vt");

/** El query string de cada forma de mandar el valor */
export function payload(p: Preset, value: string): string {
  const data = bytesOf(value);
  switch (p) {
    case "plain":
      return `q=${value}`;
    case "percent":
      return `q=${data.map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("")}`;
    case "base64":
      return `q=${b64(bytesOf(JSON.stringify({ k: value })))}`;
    case "hex":
      return `q=${hexOf(data)}`;
    case "split":
      return `q=${value.slice(0, 13)}&r=${value.slice(13)}`;
    case "reverse":
      return `q=${[...value].reverse().join("")}`;
    case "xor":
      return `q=${b64(data.map((b, i) => b ^ XOR_KEY[i % XOR_KEY.length]))}`;
  }
}

/** La request entera (lo que revisa el firewall) y si secret-egress encuentra el valor */
export function request(p: Preset, value: string, host: string) {
  const query = `?${payload(p, value)}`;
  return { query, match: detect(`${host}${query}`, value) };
}

/* ---------- las fichas ---------- */

const KEY = [...m.value];
/** Una ficha por carácter de la key; lo que no entra termina en una ficha con … */
export const SLOTS = KEY.length;
const MORE = "…";

/** Lo que muestran las fichas al salir: el valor del query, partido si va en dos parámetros */
export type Look = {
  chars: string[];
  /** El `?q=` del primer parámetro */
  prefix: string;
  /** Desde qué ficha va el segundo parámetro (en dos) */
  gap: number | null;
  /** El `&r=` que queda entre los dos grupos */
  gapText: string;
  more: boolean;
};

export function look(p: Preset, value: string, slots: number): Look {
  const params = payload(p, value)
    .split("&")
    .map((kv) => {
      const eq = kv.indexOf("=") + 1;
      return { name: kv.slice(0, eq), chars: [...kv.slice(eq)] };
    });
  let chars = params.flatMap((q) => q.chars);
  const more = chars.length > slots;
  if (more) chars = [...chars.slice(0, slots - 1), MORE];
  const second = params[1];
  return { chars, prefix: `?${params[0].name}`, gap: second ? params[0].chars.length : null, gapText: second ? `&${second.name}` : "", more };
}

/**
 * En qué orden se da vuelta cada ficha (rango por ficha), o null si no se
 * dan vuelta: las codificaciones de izquierda a derecha, al revés desde las
 * puntas hacia el centro, cifrada salteada. En dos y tal cual no cambian.
 */
function flipOrder(p: Preset): number[] | null {
  if (p === "plain" || p === "split") return null;
  if (p === "reverse") return KEY.map((_, i) => Math.min(i, SLOTS - 1 - i));
  if (p === "xor") {
    const r = rng(1371);
    const order = KEY.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rank: number[] = [];
    order.forEach((tile, k) => (rank[tile] = k));
    return rank;
  }
  return KEY.map((_, i) => i);
}

const LOOK = Object.fromEntries(PRESETS.map((p) => [p, look(p, m.value, SLOTS)])) as Record<Preset, Look>;
const MATCH = Object.fromEntries(PRESETS.map((p) => [p, request(p, m.value, m.host).match])) as Record<Preset, Match | null>;
const ORDER = Object.fromEntries(PRESETS.map((p) => [p, flipOrder(p)])) as Record<Preset, number[] | null>;

/* ---------- la escena en el tiempo ---------- */

/** Tiempos, en segundos desde que el lector elige la forma */
const T = {
  /** La request anterior se apaga donde quedó */
  out: 0.22,
  /** La key aparece en su lugar */
  inFrom: 0.1,
  inTo: 0.34,
  /** Empieza el disfraz */
  dis: 0.42,
  /** Fichas que se dan vuelta: cada una tarda `flip` y la siguiente arranca `stag` después */
  stag: 0.04,
  flip: 0.24,
  /** El segundo grupo de en dos se separa */
  split: 0.5,
  /** Pausa antes de salir */
  pause: 0.2,
  /** Hasta el cable (las que reconoce) o hasta docs.python.org (las que pasan) */
  slide: 0.6,
  pass: 1.15,
  /** Lo que tarda en quedarse quieta la campana */
  ring: 2.1,
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const inOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const out = (u: number) => 1 - Math.pow(1 - u, 3);

function disguiseEnd(p: Preset): number {
  const order = ORDER[p];
  if (order) return T.dis + Math.max(...order) * T.stag + T.flip;
  return LOOK[p].gap === null ? T.dis : T.dis + T.split;
}
const goOf = (p: Preset) => disguiseEnd(p) + T.pause;
/** Cuándo toca el cable o llega a docs.python.org */
const hitOf = (p: Preset) => goOf(p) + (MATCH[p] ? T.slide : T.pass);
/** Cuándo termina de moverse todo */
export const endOf = (p: Preset) => hitOf(p) + (MATCH[p] ? T.ring : 0.45);

export type TileFrame = { ch: string; x: number; y: number; sy: number };
export type RowFrame = {
  preset: Preset;
  alpha: number;
  tiles: TileFrame[];
  gap: { x: number; alpha: number } | null;
  /** Cuánto hunde el cable (0 si no lo toca) */
  push: number;
  bell: number;
  ring: number;
  /** Lo que se ve del veredicto, de 0 a 1 */
  verdict: number;
  /** Dónde terminó: en el cable, en docs.python.org o todavía en camino */
  outcome: "caught" | "passed" | null;
};
export type Frame = { row: RowFrame; ghost: RowFrame | null; bend: number; bell: number; ring: number };
/** La forma anterior y en qué segundo estaba cuando el lector eligió otra */
export type Shot = { preset: Preset; t: number };

/** Respuesta del cable: llega a `D` con velocidad `v0` y se asienta (resorte amortiguado) */
function press(tau: number, D: number, v0: number): number {
  const z = 9;
  const w = 13;
  return D + Math.exp(-z * tau) * (-D * Math.cos(w * tau) + ((v0 - z * D) / w) * Math.sin(w * tau));
}

const BELL_W = (2 * Math.PI) / 0.46;

function rowAt(G: Geo, p: Preset, t: number): RowFrame {
  const L = LOOK[p];
  const caught = MATCH[p] !== null;
  const order = ORDER[p];
  const hit = hitOf(p);
  const go = goOf(p);
  const open = L.gap === null ? 0 : inOut(clamp((t - T.dis) / T.split));

  let top = G.homeY;
  let push = 0;
  const contact = G.wireY - G.th - G.clear;
  if (caught) {
    const s = clamp((t - go) / T.slide);
    top = G.homeY + (contact - G.homeY) * s * s;
    if (t > hit) {
      top = contact;
      push = press(t - hit, G.D, (2 * (contact - G.homeY)) / T.slide);
    }
  } else {
    top = G.homeY + (G.landY - G.homeY) * inOut(clamp((t - go) / T.pass));
  }

  const tiles = KEY.map((k, i): TileFrame => {
    let ch = L.chars[i];
    let sy = 1;
    if (order) {
      const u = clamp((t - T.dis - order[i] * T.stag) / T.flip);
      sy = Math.abs(Math.cos(Math.PI * u));
      if (u < 0.5) ch = k;
    }
    const x = G.x0 + i * G.pitch + G.tw / 2 + (L.gap !== null && i >= L.gap ? open * G.gapW : 0);
    const u = (x - G.xa) / (G.xb - G.xa);
    return { ch, x, y: top + push * 4 * u * (1 - u), sy };
  });

  const tau = t - hit;
  const done = t >= hit;
  return {
    preset: p,
    alpha: clamp((t - T.inFrom) / (T.inTo - T.inFrom)),
    tiles,
    // el &r= va centrado en el hueco que se abre entre los dos grupos
    gap: L.gap === null ? null : { x: G.x0 + (L.gap - 1) * G.pitch + G.tw + (G.pitch - G.tw + open * G.gapW) / 2, alpha: open },
    push,
    bell: caught && done ? G.swing * Math.exp(-tau / 0.6) * clamp(1 - tau / T.ring) * Math.sin(BELL_W * tau) : 0,
    ring: caught && done ? clamp(tau / 0.06) * clamp(1 - tau / 1.5) : 0,
    verdict: done ? clamp((tau - (caught ? 0.12 : -0.05)) / 0.24) : 0,
    outcome: done ? (caught ? "caught" : "passed") : null,
  };
}

/**
 * El cuadro del segundo `t` después de elegir `p`. Función pura del tiempo:
 * el servidor y el navegador dibujan lo mismo, y el cuadro inicial es el
 * final de START. Si había otra forma (`from`), se apaga donde quedó y el
 * cable que estaba hundido vuelve vibrando.
 */
function frameAt(G: Geo, p: Preset, t: number, from: Shot | null): Frame {
  const row = rowAt(G, p, t);
  const old = from ? rowAt(G, from.preset, from.t) : null;
  const ghost = old && t < T.out ? { ...old, alpha: old.alpha * (1 - t / T.out) } : null;
  const b0 = old?.push ?? 0;
  const twang = b0 * Math.exp(-t / 0.14) * Math.cos(2 * Math.PI * 5 * t);
  const back = old ? Math.exp(-t / 0.45) * (old.bell * Math.cos(BELL_W * t) + G.swing * 0.3 * (b0 / G.D) * Math.sin(BELL_W * t)) : 0;
  return { row, ghost, bend: row.push + twang, bell: row.bell + back, ring: Math.max(row.ring, ghost ? ghost.ring * ghost.alpha : 0) };
}

/* ---------- dibujo ---------- */

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  /** Fichas: borde izquierdo de la primera, ancho, alto, paso y el hueco de en dos */
  x0: number;
  tw: number;
  th: number;
  pitch: number;
  gapW: number;
  /** Arriba de la fila en casa y en el buscador de docs.python.org */
  homeY: number;
  landY: number;
  /** El cable: altura, postes y cuánto se hunde */
  wireY: number;
  xa: number;
  xb: number;
  D: number;
  clear: number;
  /** De qué poste cuelga la campana y cuánto se hamaca (grados) */
  bell: "left" | "right";
  swing: number;
  src: Pt;
  host: Pt;
  /** El buscador donde cae lo que pasa */
  field: { x: number; y: number; w: number; h: number };
  note: { x: number; y: number; lines: readonly string[] };
  verdict: Pt;
  /** El detalle del veredicto: abajo del sello (ancha) o a su derecha, corrido `detail[0]` (angosta) */
  detail: Pt;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 234,
  x0: 40,
  tw: 20,
  th: 28,
  pitch: 23,
  gapW: 30,
  homeY: 28,
  landY: 186,
  wireY: 116,
  xa: 18,
  xb: 528,
  D: 15,
  clear: 1.5,
  bell: "right",
  swing: 34,
  src: [40, 14],
  host: [18, 166],
  field: { x: 28, y: 178, w: 488, h: 44 },
  note: { x: 566, y: 50, lines: [m.wire, ...m.looks] },
  verdict: [566, 158],
  detail: [566, 188],
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 266,
  x0: 16,
  tw: 15.5,
  th: 24,
  pitch: 17.5,
  gapW: 19,
  homeY: 22,
  landY: 205,
  wireY: 100,
  xa: 5,
  xb: 375,
  D: 12,
  clear: 1.5,
  bell: "left",
  swing: 34,
  src: [16, 12],
  host: [8, 189],
  field: { x: 8, y: 198, w: 368, h: 38 },
  note: { x: 0, y: 262, lines: [[m.wire, ...m.looks].join(" ")] },
  verdict: [22, 152],
  detail: [12, 146],
};

/** El trazo de cada ficha y su leve torcido de ficha puesta a mano, con semilla fija */
function tilePaint(G: Geo) {
  return KEY.map((_, i) => {
    const r = rng(1400 + i);
    return {
      ink: sketch(r, rectPts(-G.tw / 2, -G.th / 2, G.tw, G.th), true, 0.9, 0.4),
      rot: fx((r() - 0.5) * 3),
      dy: fx((r() - 0.5) * 1.6),
    };
  });
}
type TilePaint = ReturnType<typeof tilePaint>;

/** Pared a los costados de la puerta: contorno a mano y rayado */
function wall(x1: number, x2: number, y: number, h: number, seed: number) {
  const pts = rectPts(x1, y - h / 2, x2 - x1, h);
  let hatch = "";
  for (let x = x1 + 3; x < x2 + h; x += 7) {
    let [ax, ay, bx, by] = [x, y - h / 2, x - h, y + h / 2];
    if (ax > x2) [ax, ay] = [x2, ay + (ax - x2)];
    if (bx < x1) [bx, by] = [x1, by - (x1 - bx)];
    if (ay < by) hatch += `M${fx(ax)} ${fx(ay)}L${fx(bx)} ${fx(by)}`;
  }
  return { fill: poly(pts), ink: sketch(rng(seed), pts, true, 1, 0.3), hatch };
}

const PAINT = { wide: tilePaint(WIDE), narrow: tilePaint(NARROW) };

/** El cuadro de la escena ancha (o la angosta) en el segundo `t` después de elegir `p` */
export const tripwireAt = (p: Preset, t: number, from: Shot | null = null, narrow = false) => frameAt(narrow ? NARROW : WIDE, p, t, from);
const alpha = (v: number) => Math.round(v * 100) / 100;

function Row({ G, r, paint }: { G: Geo; r: RowFrame; paint: TilePaint }) {
  const half = G.th / 2;
  const fill = poly(rectPts(-G.tw / 2, -half, G.tw, G.th));
  return (
    <g opacity={alpha(r.alpha)}>
      {r.gap && (
        <text x={fx(r.gap.x)} y={fx(r.tiles[0].y + half + 4.5)} textAnchor="middle" className="et-gap" opacity={alpha(r.gap.alpha)}>
          {LOOK[r.preset].gapText}
        </text>
      )}
      {r.tiles.map((tile, i) => (
        <g
          key={i}
          className={tile.ch === MORE ? "et-tile et-more" : "et-tile"}
          transform={`translate(${fx(tile.x)} ${fx(tile.y + half + paint[i].dy)}) rotate(${paint[i].rot}) scale(1 ${Math.max(0.02, alpha(tile.sy))})`}
        >
          <path d={fill} className="et-tile-bg" />
          <path d={paint[i].ink} className="et-tile-ink" />
          <text x={0} y={G.narrow ? 4.3 : 5} textAnchor="middle" className="et-ch">
            {tile.ch}
          </text>
        </g>
      ))}
    </g>
  );
}

const STAMP_W = m.verdicts.deny.length * 6.9 + 16;
const TAG_W = m.verdicts.allow.length * 6.9 + 16;
const STAMP = sketch(rng(1460), rectPts(-8, -17, STAMP_W, 24), true, 1.1, 0.5);
const TAG = sketch(rng(1461), rectPts(-8, -17, TAG_W, 24), true, 1.1, 0.5);

function Verdict({ G, r }: { G: Geo; r: RowFrame }) {
  const match = MATCH[r.preset];
  const a = r.alpha * r.verdict;
  if (a <= 0) return null;
  const [x, y] = G.verdict;
  const dx = G.narrow ? x + (match ? STAMP_W : TAG_W) + G.detail[0] : G.detail[0];
  const dy = G.detail[1];
  const lines = match ? [m.matched(m.forms[match.form]), ...(match.decoded ? [m.decoded] : [])] : [m.unmatched];
  // el sello cae: llega un poco más grande y se asienta
  const k = match ? 1 + 0.25 * (1 - out(clamp(r.verdict * 1.3))) : 1;
  return (
    <g opacity={alpha(a)}>
      <g transform={`translate(${x + 8} ${y}) rotate(${match ? -3 : 0}) scale(${alpha(k)})`}>
        <path d={match ? STAMP : TAG} className={match ? "et-stamp" : "et-tag"} />
        <text x={0} y={0} className={match ? "et-deny" : "et-allow"}>
          {match ? m.verdicts.deny : m.verdicts.allow}
        </text>
      </g>
      {lines.map((line, i) => (
        <text key={line} x={dx} y={dy + i * 16} className="s-lab">
          {line}
        </text>
      ))}
    </g>
  );
}

function Scene({ G, f, label, paint }: { G: Geo; f: Frame; label: string; paint: TilePaint }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const F = G.field;
  const xm = (G.xa + G.xb) / 2;
  const wire = `M${G.xa} ${G.wireY}Q${fx(xm)} ${fx(G.wireY + 2 * f.bend)} ${G.xb} ${G.wireY}`;
  const left = wall(vb[0] - 2, G.xa - 3, G.wireY, 9, 1450);
  const right = wall(G.xb + 3, vb[0] + vb[2] + 2, G.wireY, 9, 1451);
  const bx = G.bell === "left" ? G.xa : G.xb;
  const by = G.wireY + 9;
  const s = 20;

  return (
    <svg className={`ink still ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* de dónde sale la key */}
      <Glyph name="file" x={G.src[0]} y={G.src[1] - 12} s={14} />
      <text x={G.src[0] + 19} y={G.src[1]} className="s-file">
        {m.env}
      </text>
      <text x={G.src[0] + 19 + (m.env.length + 1) * 7.2} y={G.src[1]} className="s-lab s-mono">
        {m.envKey}
      </text>

      {/* adónde va: el buscador de docs.python.org */}
      <Glyph name="globe" x={G.host[0]} y={G.host[1] - 12} s={14} />
      <text x={G.host[0] + 20} y={G.host[1]} className="s-file">
        {m.host}
        <tspan className="et-q">{LOOK[f.row.preset].prefix}</tspan>
      </text>
      <path d={poly(rectPts(F.x, F.y, F.w, F.h))} className="s-fill" />
      <path d={sketch(rng(1452), rectPts(F.x, F.y, F.w, F.h), true, 1.2, 0.5)} className="s-ink-thin" />

      {/* lo que busca el cable */}
      {G.note.lines.map((line, i) => (
        <text key={line} x={G.note.x} y={G.note.y + i * 17} className={i === 0 && !G.narrow ? "s-title" : "s-lab"}>
          {line}
        </text>
      ))}

      {/* la pared con la puerta */}
      {[left, right].map((w, i) => (
        <g key={i}>
          <path d={w.fill} className="s-fill" />
          <path d={w.hatch} className="et-hatch" />
          <path d={w.ink} className="s-ink-thin" />
        </g>
      ))}

      {/* la key: la que se apaga y la que sale */}
      {f.ghost && <Row G={G} r={f.ghost} paint={paint} />}
      <Row G={G} r={f.row} paint={paint} />

      {/* el cable va encima: lo que no reconoce pasa por debajo sin moverlo */}
      <path d={wire} className="et-wire" />
      <g transform={`rotate(${fx(f.bell)} ${bx} ${G.wireY})`}>
        <path d={`M${bx} ${G.wireY + 4}V${by}`} className="s-ink-thin" />
        <Glyph name="bell" x={bx - s / 2} y={by} s={s} />
      </g>
      <path
        d={`M${bx + 13} ${by + 6}q3.5 5 0 10M${bx + 18} ${by + 3}q5.5 8 0 16M${bx - 13} ${by + 6}q-3.5 5 0 10M${bx - 18} ${by + 3}q-5.5 8 0 16`}
        className="et-ring"
        opacity={alpha(f.ring)}
      />
      <Node cx={G.xa} cy={G.wireY} r={4.5} />
      <Node cx={G.xb} cy={G.wireY} r={4.5} />

      {/* el veredicto del hook */}
      {f.ghost && <Verdict G={G} r={f.ghost} />}
      <Verdict G={G} r={f.row} />
    </svg>
  );
}

type Play = { preset: Preset; t: number; from: Shot | null };

/** Figura: la key disfrazada frente al tripwire de secret-egress */
export function EgressTripwire({ name, wide, label, caption }: FigureProps) {
  const [play, setPlay] = useState<Play>({ preset: START, t: endOf(START), from: null });
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function pick(p: Preset) {
    cancelAnimationFrame(raf.current);
    const end = endOf(p);
    if (prefersReducedMotion()) {
      setPlay({ preset: p, t: end, from: null });
      return;
    }
    const from: Shot = { preset: play.preset, t: play.t };
    // el reloj arranca en el primer cuadro: el clic ya dibujó t = 0
    let t0 = -1;
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      const t = Math.min(end, (now - t0) / 1000);
      setPlay({ preset: p, t, from });
      if (t < end) raf.current = requestAnimationFrame(tick);
    };
    setPlay({ preset: p, t: 0, from });
    raf.current = requestAnimationFrame(tick);
  }

  const fw = frameAt(WIDE, play.preset, play.t, play.from);
  const fn = frameAt(NARROW, play.preset, play.t, play.from);

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} f={fw} label={label} paint={PAINT.wide} />
        <Scene G={NARROW} f={fn} label={label} paint={PAINT.narrow} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="presets" role="group" aria-label={m.presetsLabel}>
          <span className="muted">{m.try}</span>
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={play.preset === p} onClick={() => pick(p)}>
              {m.presets[p]}
            </button>
          ))}
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(m.results[play.preset])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

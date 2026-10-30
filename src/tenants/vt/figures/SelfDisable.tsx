"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { drawn, frame, fx, rectPts, rl, rng, sheetPts, sketch, xmark, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { lerp, usePlayClock } from "./sim";

const m = copy.figures.selfDisable;

export type Version = "v03" | "v04";
const VERSIONS: Version[] = ["v03", "v04"];

/* ---------- tiempos ---------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeIn = (p: number) => p * p * p;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Medidas verticales de cada página: las mismas en las dos geometrías */
const ROW = {
  agentY: 24,
  agentH: 48,
  sheetY: 44,
  sheetH: 76,
  wallTop: 150,
  wallMid: 166,
  wallBot: 182,
  slotY: 220,
  page: 296,
} as const;
/** Lo que baja la hoja hasta el proyecto, y hasta tocar el muro */
const DROP = ROW.slotY - ROW.sheetY;
const TO_WALL = ROW.wallTop - (ROW.sheetY + ROW.sheetH);
const LINK_Y = ROW.sheetY + 4;
const AGENT_BOTTOM = ROW.agentY + ROW.agentH;

/** Sesión N: el agente escribe .claude/settings.local.json */
const LINK: readonly [number, number] = [0, 0.3];
const INK: readonly [number, number] = [0.1, 0.6];
const FALL_AT = 0.75;
/** 0.3.0: la hoja cruza el muro sin que nadie la mire y cae en el proyecto */
const LAND = FALL_AT + 0.9;
const ALLOW: readonly [number, number] = [1.15, 1.45];
/** 0.4.0: la hoja choca contra el muro, rebota y se arruga */
const HIT = FALL_AT + 0.32;
const BOUNCE = 0.24;
const CRUMPLE = 0.42;
const THUMP = 0.22;
/** Arranca la sesión N+1 */
const SWITCH: Record<Version, number> = { v03: 2.05, v04: 2.15 };
const LIGHT = 0.4;
/** 0.3.0: el archivo sigue en el disco, el host lo lee y el muro se borra */
const CARRY: readonly [number, number] = [2.55, 3.35];
const HOST: readonly [number, number] = [3.5, 3.9];
const ERASE: readonly [number, number] = [4.05, 5.2];
const GHOST: readonly [number, number] = [5.0, 5.35];
/** Read .env: llega al archivo (0.3.0) o al muro (0.4.0) */
const READ: Record<Version, readonly [number, number]> = { v03: [5.6, 6.3], v04: [2.85, 3.25] };
const OPEN: readonly [number, number] = [6.3, 6.7];
const SAFE: readonly [number, number] = [3.65, 3.95];
export const SD_END: Record<Version, number> = { v03: 7.0, v04: 4.25 };

export type SdFrame = {
  /* lo que pasó */
  settings: "absent" | "written";
  /** El hook en la sesión N+1: todavía no arrancó, cargado o no cargado */
  hookNext: "pending" | "on" | "off";
  decisions: { write: "allow" | "fs" | null; read: "fs" | null };
  envRead: boolean;
  phase: "write" | "decided" | "session" | "read" | "done";
  done: boolean;
  /* el dibujo (0 a 1, salvo `fall`, en unidades) */
  link: number;
  ink: number;
  fall: number;
  bounce: number;
  crumple: number;
  ball: number;
  allowTag: number;
  stampN: number;
  /** Brillo de la página N+1 (antes de arrancar se ve apagada) */
  next: number;
  carry: number;
  host: number;
  erase: number;
  ghostTag: number;
  read: number;
  stampNext: number;
  open: number;
  safe: number;
};

/**
 * Qué pasa en el segundo `t`. En 0.3.0 la escritura pasa, la sesión N+1 lee
 * ese archivo y arranca sin el hook (el muro se borra), y Read .env llega al
 * archivo. En 0.4.0 el hook protege su configuración aunque no exista: la
 * escritura se rechaza, el hook sigue cargado y Read .env se rechaza también.
 * Función pura del tiempo.
 */
export function simulateSelfDisable(v: Version, t: number): SdFrame {
  const v04 = v === "v04";
  const sw = SWITCH[v];
  const [r0, r1] = READ[v];
  const end = SD_END[v];
  const decidedAt = v04 ? HIT : ALLOW[0];
  const after = HIT + BOUNCE;
  return {
    settings: !v04 && t >= LAND ? "written" : "absent",
    hookNext: t < sw ? "pending" : v04 ? "on" : "off",
    decisions: { write: t < decidedAt ? null : v04 ? "fs" : "allow", read: v04 && t >= r1 ? "fs" : null },
    envRead: !v04 && t >= r1,
    phase: t < decidedAt ? "write" : t < sw ? "decided" : t < r0 ? "session" : t < end ? "read" : "done",
    done: t >= end,
    link: span(t, ...LINK),
    ink: easeOut(span(t, ...INK)),
    fall: v04 ? TO_WALL * easeIn(span(t, FALL_AT, HIT)) : DROP * easeInOut(span(t, FALL_AT, LAND)),
    bounce: v04 ? easeOut(span(t, HIT, after)) : 0,
    crumple: v04 ? easeInOut(span(t, after, after + CRUMPLE)) : 0,
    ball: v04 ? span(t, after + CRUMPLE - 0.14, after + CRUMPLE + 0.08) : 0,
    allowTag: v04 ? 0 : span(t, ...ALLOW),
    stampN: v04 ? span(t, HIT + 0.04, HIT + 0.04 + THUMP) : 0,
    next: easeInOut(span(t, sw, sw + LIGHT)),
    carry: v04 ? 0 : easeInOut(span(t, ...CARRY)),
    host: v04 ? 0 : span(t, ...HOST),
    erase: v04 ? 0 : easeInOut(span(t, ...ERASE)),
    ghostTag: v04 ? 0 : span(t, ...GHOST),
    read: v04 ? easeIn(span(t, r0, r1)) : easeInOut(span(t, r0, r1)),
    stampNext: v04 ? span(t, r1 + 0.04, r1 + 0.04 + THUMP) : 0,
    open: v04 ? 0 : easeOut(span(t, ...OPEN)),
    safe: v04 ? span(t, ...SAFE) : 0,
  };
}

/* ---------- el muro ---------- */

type Stroke = { d: string; L: number; kind: "run" | "joint"; dist: number };
type Brick = { x: number; y: number; w: number; dist: number };
type Wall = { strokes: Stroke[]; bricks: Brick[]; ghost: string; reach: number };

/** Cada hilada arranca a borrarse un poco después que la de arriba */
const ROW_LAG = 26;
/** Lo que tarda en retraerse una junta desde que la alcanza el frente */
const JOINT = 34;

/**
 * El firewall es una pared de ladrillos a mano. Las hiladas se dibujan desde
 * `x0` hacia afuera, así el borrado se abre desde ahí (donde la toca el host).
 */
function wall(pw: number, x0: number, seed: number): Wall {
  const r = rng(seed);
  const { wallTop: a, wallMid: b, wallBot: c } = ROW;
  const strokes: Stroke[] = [];
  [a, b, c].forEach((y, i) => {
    for (const end of [0, pw]) {
      const len = Math.abs(end - x0);
      if (len > 1) strokes.push({ d: rl(r, x0, y, end, y, 1.4, 0.9), L: Math.ceil(len) + 8, kind: "run", dist: i * ROW_LAG });
    }
  });
  const joints: [number, number, number, number][] = [
    [0, a, c, ROW_LAG],
    [pw, a, c, ROW_LAG],
  ];
  const bricks: Brick[] = [];
  // dos hiladas de ladrillos de 48, la de abajo corrida medio ladrillo
  [
    [24, a, ROW_LAG / 2],
    [48, b, (ROW_LAG * 3) / 2],
  ].forEach(([first, y, lag]) => {
    let from = 0;
    for (let x = first; x < pw + 42; x += 48) {
      const to = Math.min(x, pw);
      if (x < pw - 6) joints.push([x, y, y + 16, lag]);
      const near = from <= x0 && x0 <= to ? 0 : Math.min(Math.abs(from - x0), Math.abs(to - x0));
      bricks.push({ x: from, y, w: to - from, dist: near + lag });
      from = to;
      if (to === pw) break;
    }
  });
  let ghost = `M0 ${a}H${pw}M0 ${b}H${pw}M0 ${c}H${pw}`;
  for (const [x, y1, y2, lag] of joints) {
    strokes.push({ d: rl(r, x, y1, x, y2, 0.8, 0.4), L: y2 - y1 + 6, kind: "joint", dist: Math.abs(x - x0) + lag });
    ghost += `M${x} ${y1}V${y2}`;
  }
  return { strokes, bricks, ghost, reach: Math.max(x0, pw - x0) + 2 * ROW_LAG + JOINT + 8 };
}

/** Cuánto de cada trazo ya se borró cuando el frente va por `front` */
function erased(s: Stroke, front: number): CSSProperties | undefined {
  if (front <= 0) return undefined;
  const dash = `${s.L} ${s.L}`;
  if (s.kind === "run") return { strokeDasharray: dash, strokeDashoffset: fx(-Math.max(0, Math.min(s.L, front - s.dist))) };
  return { strokeDasharray: dash, strokeDashoffset: fx(clamp01((front - s.dist) / JOINT) * s.L) };
}

/** El bollo de papel que queda cuando 0.4.0 rechaza la hoja */
function ballShape(seed: number) {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rad = (i % 2 ? 11.5 : 14.5) + (r() - 0.5) * 3;
    pts.push([fx(Math.cos(a) * rad), fx(Math.sin(a) * rad * 0.9)]);
  }
  const folds: Pt[][] = [
    [
      [-9, -3],
      [-3, 0],
      [1, -5],
    ],
    [
      [-4, 7],
      [2, 3],
      [8, 6],
    ],
    [
      [3, -10],
      [5, -4],
    ],
  ];
  return { ...drawn(pts, seed + 1, { o: 1, b: 0.5 }), creases: folds.map((f) => sketch(r, f, false, 0.6, 0.4)).join("") };
}

const BALL = ballShape(1311);

/* ---------- dibujo ---------- */

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  /** Ancho de cada página y dónde empieza cada una */
  pw: number;
  pages: { n: Pt; next: Pt };
  sheetW: number;
  agentX: number;
  agentW: number;
  envX: number;
  envW: number;
  /** Por dónde baja la hoja y por dónde baja la lectura */
  writeX: number;
  readX: number;
  /** Dónde el host lee el archivo (y desde dónde se borra el muro) */
  hostX: number;
  ball: Pt;
  divider: { d: string; node: Pt; label: Pt; anchor: "middle" | "start" };
  walls: { n: Wall; next: Wall };
};

function geo(narrow: boolean): Geo {
  // el mono del navegador va a ~7,1 unidades por letra también en 11px: la hoja tiene que entrar "disableAllHooks"
  const pw = narrow ? 380 : 340;
  const sheetW = narrow ? 200 : 184;
  const agentW = narrow ? 116 : 108;
  const envW = narrow ? 160 : 146;
  const gap = narrow ? 48 : 60;
  const next: Pt = narrow ? [0, ROW.page + gap] : [pw + gap, 0];
  const hostX = 40;
  const mid = narrow ? ROW.page + gap / 2 : pw + gap / 2;
  return {
    narrow,
    M: narrow ? 12 : 20,
    W: narrow ? pw : 2 * pw + gap,
    H: narrow ? 2 * ROW.page + gap : ROW.page,
    pw,
    pages: { n: [0, 0], next },
    sheetW,
    agentX: pw - agentW,
    agentW,
    envX: pw - envW,
    envW,
    writeX: sheetW / 2,
    readX: pw - agentW / 2,
    hostX,
    ball: [sheetW / 2 + (narrow ? 48 : 44), 126],
    // la guía se corta alrededor del nodo y del rótulo
    divider: narrow
      ? { d: `M0 ${mid}H${pw / 2 - 18}M${pw / 2 + 80} ${mid}H${pw}`, node: [pw / 2, mid], label: [pw / 2 + 20, mid + 4], anchor: "start" }
      : { d: `M${mid} 0V${ROW.wallMid - 18}M${mid} ${ROW.wallBot + 26}V${ROW.page}`, node: [mid, ROW.wallMid], label: [mid, ROW.wallBot + 16], anchor: "middle" },
    walls: { n: wall(pw, hostX, narrow ? 1321 : 1301), next: wall(pw, hostX, narrow ? 1322 : 1302) },
  };
}

const WIDE = geo(false);
const NARROW = geo(true);

const TAG_CHAR = 7.2;
/** Distancia entre el punto donde la llamada toca el muro y su rótulo */
const TAG_GAP = 20;
const tagW = (text: string) => text.length * TAG_CHAR + 18;
const op = (o: number): CSSProperties => ({ opacity: fx(o * 100) / 100 });

function Tag({ cx, text, kind, opacity }: { cx: number; text: string; kind: "dead" | "ink"; opacity: number }) {
  const w = tagW(text);
  const h = 22;
  const x = fx(cx - w / 2);
  const y = ROW.wallMid - h / 2;
  return (
    <g style={op(opacity)}>
      <rect x={x} y={y} width={w} height={h} rx={4} className="s-fill" />
      <rect x={x} y={y} width={w} height={h} rx={4} className={`s-tag-${kind}`} />
      <text x={cx} y={y + 15} textAnchor="middle" className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

/** El sello de la regla: entra grande y se asienta, como un golpe */
function Stamp({ cx, p, seed }: { cx: number; p: number; seed: number }) {
  const w = tagW(m.stamp);
  const h = 22;
  const shape = drawn(rectPts(-w / 2, -h / 2, w, h), seed, { o: 1, b: 0.4 });
  const s = 1 + 0.55 * (1 - easeOut(p));
  return (
    <g transform={`translate(${fx(cx)} ${ROW.wallMid}) rotate(-5) scale(${fx(s * 100) / 100})`} style={op(Math.min(1, p * 2.5))}>
      <path d={shape.fill} className="s-fill" />
      <path d={shape.ink} className="s-ink-thin" />
      <text x={0} y={4} textAnchor="middle" className="sd-stamp">
        {m.stamp}
      </text>
    </g>
  );
}

/** La hoja de .claude/settings.local.json, con el origen en su esquina */
function Settings({ w, ink, seed }: { w: number; ink: number; seed: number }) {
  const shape = drawn(sheetPts(0, 0, w, ROW.sheetH, 10), seed, { fold: 10 });
  const per = 2 * (w + ROW.sheetH) + 40;
  const row = (i: number) => op(clamp01((ink - 0.35 - i * 0.18) / 0.3));
  return (
    <g>
      <path d={shape.fill} className="s-fill" style={op(Math.min(1, ink * 2))} />
      <path d={shape.ink} className="s-ink" style={ink < 1 ? { strokeDasharray: `${per} ${per}`, strokeDashoffset: fx((1 - ink) * per) } : undefined} />
      <text x={12} y={20} className="sd-small" style={row(0)}>
        {m.settingsDir}
      </text>
      <text x={12} y={37} className="s-file" style={row(1)}>
        {m.settingsFile}
      </text>
      <text x={12} y={61} className="sd-payload" style={row(2)}>
        {m.payload}
      </text>
    </g>
  );
}

function Wall({ w, front }: { w: Wall; front: number }) {
  return (
    <g>
      <path d={w.ghost} className="sd-wallghost" />
      {/* cada ladrillo se vacía cuando el borrado pasa por su centro */}
      {w.bricks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={16} className="s-fill" style={front > 0 ? op(1 - clamp01((front - b.dist) / 40)) : undefined} />
      ))}
      {w.strokes.map((s, i) => (
        <path key={i} d={s.d} className="s-ink" style={erased(s, front)} />
      ))}
    </g>
  );
}

function Env({ G, open, safe, seed }: { G: Geo; open: number; safe: number; seed: number }) {
  const w = G.envW;
  return (
    <g transform={`translate(${G.envX} ${ROW.slotY})`}>
      <Drawn pts={sheetPts(0, 0, w, ROW.sheetH, 10)} seed={seed} fold={10} />
      <text x={12} y={22} className="s-file">
        {m.env}
      </text>
      <text x={12} y={43} className="sd-small">
        {m.envKey}
      </text>
      <g style={op(1 - open)}>
        <path d={rl(rng(seed + 5), 16, 58, 96, 58, 1, 0.6)} className="sd-redact" />
      </g>
      <g className="is-key" style={op(open)}>
        <rect x={6} y={47} width={w - 12} height={19} rx={3} className="s-keybg" />
        <text x={12} y={61} className="s-file">
          {m.envValue}
        </text>
      </g>
      <text x={w - 16} y={22} textAnchor="end" className="t-key" style={op(open)}>
        {m.read}
      </text>
      <text x={w - 16} y={22} textAnchor="end" className="t-safe" style={op(safe)}>
        {m.unread}
      </text>
    </g>
  );
}

function Agent({ G, seed }: { G: Geo; seed: number }) {
  const x = G.agentX;
  return (
    <g>
      <Drawn pts={rectPts(x, ROW.agentY, G.agentW, ROW.agentH)} seed={seed} />
      <text x={x + 12} y={ROW.agentY + 20} className="s-title">
        {m.agent}
      </text>
      <text x={x + 12} y={ROW.agentY + 38} className="s-lab">
        {m.agentSub}
      </text>
      <Glyph name="bot" x={x + G.agentW - 28} y={ROW.agentY + 10} />
    </g>
  );
}

/** Lo que tienen las dos páginas: encabezado, proyecto, muro y agente */
function PageBase({ G, which, front, seed, slot = 1 }: { G: Geo; which: "n" | "next"; front: number; seed: number; slot?: number }) {
  return (
    <>
      <text x={0} y={12} className="s-hash">
        {m.sessions[which]}
      </text>
      <g style={slot < 1 ? op(slot) : undefined}>
        <rect x={0} y={ROW.slotY} width={G.sheetW} height={ROW.sheetH} rx={2} className="sd-ghost" />
        <text x={G.sheetW / 2} y={ROW.slotY + ROW.sheetH / 2 + 4} textAnchor="middle" className="s-lab">
          {m.absent}
        </text>
      </g>
      <Wall w={G.walls[which]} front={front} />
      <text x={0} y={ROW.wallTop - 8} className="s-lab">
        {m.wall}
      </text>
      <Agent G={G} seed={seed} />
    </>
  );
}

function Scene({ G, v, f, label }: { G: Geo; v: Version; f: SdFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const v04 = v === "v04";
  const { pages, sheetW: sw, writeX, readX, hostX } = G;
  const tr = (p: Pt) => `translate(${p[0]} ${p[1]})`;

  // la hoja de la sesión N: baja, y en 0.4.0 rebota y se arruga
  const top = ROW.sheetY + f.fall - 16 * f.bounce;
  const c0: Pt = [sw / 2, top + ROW.sheetH / 2];
  const center = lerp(c0, G.ball, f.crumple);
  const scale = 1 - 0.84 * f.crumple;
  const rot = -6 * f.bounce - 44 * f.crumple;
  const sheetOpacity = (f.link > 0 ? 1 : 0) * (1 - clamp01((f.crumple - 0.55) / 0.45));
  const sheetT = `translate(${fx(center[0])} ${fx(center[1])}) rotate(${fx(rot)}) scale(${fx(scale * 100) / 100}) translate(${-sw / 2} ${-ROW.sheetH / 2})`;

  // la llamada Write: del agente a la hoja, y detrás de la hoja hasta donde llegó
  const bottom = Math.min(ROW.sheetY + ROW.sheetH + f.fall, v04 ? ROW.wallTop : ROW.slotY + ROW.sheetH);
  const writeD =
    f.link < 1
      ? `M${G.agentX} ${LINK_Y}H${fx(G.agentX - (G.agentX - sw) * f.link)}`
      : `M${G.agentX} ${LINK_Y}H${writeX + 10}Q${writeX} ${LINK_Y} ${writeX} ${LINK_Y + 10}V${fx(bottom)}`;

  // la llamada Read de la sesión N+1
  const readTo = v04 ? ROW.wallTop : ROW.slotY;
  const readY = AGENT_BOTTOM + (readTo - AGENT_BOTTOM) * f.read;
  const reading = f.read > 0 && f.read < 1;
  const front = f.erase * G.walls.next.reach;

  // el archivo sigue en el disco: en ancho la copia cruza el reinicio por detrás del .env;
  // en angosto ese camino pasaría por el muro de N+1, así que se asienta en su lugar
  const to: Pt = [pages.next[0] - pages.n[0], pages.next[1] - pages.n[1] + ROW.slotY];
  const carried: Pt = G.narrow ? [to[0], to[1] - 14 * (1 - f.carry)] : lerp([0, ROW.slotY], to, f.carry);
  const carriedOpacity = G.narrow ? f.carry : f.carry > 0 ? 1 : 0;

  const allowW = tagW(m.allow);
  const stampW = tagW(m.stamp);
  const offW = tagW(m.notLoaded);

  return (
    <svg className={`ink still ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el reinicio entre las dos sesiones */}
      <path d={G.divider.d} className="s-guide" />
      <text x={G.divider.label[0]} y={G.divider.label[1]} textAnchor={G.divider.anchor} className="s-lab">
        {m.restart}
      </text>
      <circle cx={G.divider.node[0]} cy={G.divider.node[1]} r={12} className="sd-node" />
      <Glyph name="restart" x={G.divider.node[0] - 7} y={G.divider.node[1] - 7} s={14} />

      {/* sesión N: el agente escribe la hoja */}
      <g transform={tr(pages.n)}>
        <PageBase G={G} which="n" front={0} seed={1201} />
        <Tag cx={writeX + TAG_GAP + allowW / 2} text={m.allow} kind="dead" opacity={f.allowTag} />
        <text x={(G.agentX + sw) / 2} y={LINK_Y - 8} textAnchor="middle" className="sd-call" style={op(f.link > 0 ? 1 : 0)}>
          {m.writeCall}
        </text>
        <path d={writeD} className="s-link" style={op(f.link > 0 ? 1 : 0)} />
        <g transform={sheetT} style={op(sheetOpacity)}>
          <Settings w={sw} ink={f.ink} seed={1203} />
        </g>
        <g transform={tr(G.ball)} style={op(f.ball)}>
          <path d={BALL.fill} className="s-fill" />
          <path d={BALL.ink} className="s-ink-thin" />
          <path d={BALL.creases} className="s-ink-thin" />
        </g>
        <g style={op(f.stampN > 0 ? 1 : 0)}>
          <path d={xmark(writeX, ROW.wallTop, 6)} className="s-x" />
        </g>
        <Stamp cx={writeX + TAG_GAP + stampW / 2} p={f.stampN} seed={1205} />
        <g transform={tr(carried)} style={op(carriedOpacity)}>
          <Settings w={sw} ink={1} seed={1213} />
        </g>
        <Env G={G} open={0} safe={0} seed={1204} />
      </g>

      {/* sesión N+1: arranca apagada hasta que le toca */}
      <g transform={tr(pages.next)} style={op(0.32 + 0.68 * f.next)}>
        <PageBase G={G} which="next" front={front} seed={1211} slot={1 - f.carry} />
        <Env G={G} open={f.open} safe={f.safe} seed={1214} />
        <g style={op(f.host)}>
          <path d={`M${hostX} ${ROW.slotY}V${ROW.wallBot}`} className="s-guide" />
          <text x={hostX + 10} y={ROW.wallBot + 23} className="s-lab">
            {m.hostReads}
          </text>
        </g>
        <Tag cx={readX - TAG_GAP - offW / 2} text={m.notLoaded} kind="dead" opacity={f.ghostTag} />
        <text x={readX - 9} y={(AGENT_BOTTOM + ROW.wallTop) / 2 + 4} textAnchor="end" className="sd-call" style={op(f.read > 0 ? 1 : 0)}>
          {m.readCall}
        </text>
        <path d={`M${readX} ${AGENT_BOTTOM}V${fx(readY)}`} className="s-link" style={op(f.read > 0 ? 1 : 0)} />
        <circle cx={readX} cy={fx(readY)} r={3.5} className="s-req" style={op(reading ? 1 : 0)} />
        <g style={op(f.stampNext > 0 ? 1 : 0)}>
          <path d={xmark(readX, ROW.wallTop, 6)} className="s-x" />
        </g>
        <Stamp cx={readX - TAG_GAP - stampW / 2} p={f.stampNext} seed={1215} />
      </g>
    </svg>
  );
}

function result(v: Version, f: SdFrame) {
  const v04 = v === "v04";
  if (f.phase === "done") return m.results[v];
  if (f.phase === "write") return m.results.write;
  if (f.phase === "decided") return v04 ? m.results.refused : m.results.allowed;
  if (f.phase === "session") return v04 ? m.results.sessionOn : m.results.sessionOff;
  return v04 ? m.results.readOn : m.results.readOff;
}

/** Figura: el agente reescribe lo que carga su propio firewall y la sesión siguiente arranca sin él */
export function SelfDisable({ name, wide, label, caption }: FigureProps) {
  const [v, setV] = useState<Version>("v03");
  const { t, playing, canvas, play, toggle, reset } = usePlayClock(SD_END.v03);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateSelfDisable(v, Math.min(t, SD_END[v]));

  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  /** Con reduced motion se salta al final: el estado final se entiende solo */
  function start(next: Version) {
    if (prefersReducedMotion()) {
      reset(SD_END[next]);
      return;
    }
    reset(0);
    play();
  }

  function pick(next: Version) {
    if (next === v) return;
    setV(next);
    start(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = VERSIONS[(VERSIONS.indexOf(v) + 1) % VERSIONS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
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
        <Scene G={WIDE} v={v} f={f} label={label} />
        <Scene G={NARROW} v={v} f={f} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          <button type="button" className="plain" onClick={() => start(v)}>
            {`↺ ${m.again}`}
          </button>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(v, f))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

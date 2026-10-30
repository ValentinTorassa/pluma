"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { frame, rectPts, rl, rng, sketch, type Pt } from "./ink";
import { prefersReducedMotion, useSvgId } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { STILL, usePlayClock } from "./sim";

const m = copy.figures.allowlistEgress;

export type Version = "v03" | "v04";
const VERSIONS: Version[] = ["v03", "v04"];

/** Las reglas de 0.4.0 que frenan algo: la del valor (el escáner) y la de rutas (la etiqueta) */
export type Rule = "secret-egress" | "sh-paths";

/**
 * Las tres requests del artículo y qué regla las frena en cada versión. En
 * 0.3.0 no las frena nadie: la allowlist lee la etiqueta (herramienta y
 * destino) y las tres están en regla. En 0.4.0 secret-egress encuentra el
 * valor de la key en las dos que lo llevan, y sh-paths lee `@.env` en la
 * etiqueta de la primera.
 */
export const REQUESTS: readonly { stop: Record<Version, Rule | null> }[] = [
  { stop: { v03: null, v04: "sh-paths" } },
  { stop: { v03: null, v04: "secret-egress" } },
  { stop: { v03: null, v04: "secret-egress" } },
];

/* ---------- simulación: función pura del tiempo ---------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Avance de 0 a 1 entre `a` y `b` */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** ease in-out cúbico, el mismo de los contadores */
export const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Del agente al control */
const APPROACH = 0.8;
/** El ojo de la aduana lee la etiqueta */
const READ = 0.55;
/** La barrera sube o baja */
const LIFT = 0.3;
/** Del control al buzón de docs.python.org */
const PASS = 0.95;
/** Se ve lo que llevaba adentro */
const OPEN = 0.35;
/** Entre una salida y la siguiente, en 0.3.0 */
const GAP = 1.75;
/** El escáner cruza el paquete */
const SWEEP = 0.55;
/** El sello cae */
const STAMP = 0.22;
/** A la bandeja de rechazadas */
const DROP = 0.5;
/** La trampa del piso se abre o se cierra */
const DOOR = 0.15;

type Plan03 = { dep: number; arr: number; lift: number; go: number; land: number };
type Plan04 = { dep: number; arr: number; swept: number; read: number | null; stamp: number; drop: number; land: number };

const PLAN03: Plan03[] = REQUESTS.map((_, i) => {
  const dep = i * GAP;
  const arr = dep + APPROACH;
  const lift = arr + READ;
  const go = lift + LIFT * 0.7;
  return { dep, arr, lift, go, land: go + PASS };
});

const PLAN04: Plan04[] = (() => {
  const out: Plan04[] = [];
  let dep = 0;
  for (const r of REQUESTS) {
    const arr = dep + APPROACH;
    const swept = arr + SWEEP;
    // el escáner va primero; si no encontró el valor, recién ahí se lee la etiqueta
    const read = r.stop.v04 === "sh-paths" ? swept + 0.1 : null;
    const stamp = read === null ? swept + 0.05 : read + 0.45;
    const drop = stamp + STAMP + 0.23;
    out.push({ dep, arr, swept, read, stamp, drop, land: drop + DROP });
    dep = stamp + 0.3;
  }
  return out;
})();

export const AE_END: Record<Version, number> = {
  v03: PLAN03[PLAN03.length - 1].land + OPEN + 0.15,
  v04: PLAN04[PLAN04.length - 1].land + DOOR + 0.1,
};
/** El cuadro inicial: 0.3.0 terminado, los tres paquetes abiertos en el buzón */
export const AE_START = AE_END.v03;

export type Place = "agent" | "stop" | "inbox" | "rejected";

export type ParcelFrame = {
  /** Tramo entre dos lugares y su avance, ya suavizado */
  from: Place;
  to: Place;
  p: number;
  opacity: number;
  /** Vista de adentro: hasta dónde la barrió el escáner (0..1) y su opacidad */
  reveal: number;
  inside: number;
  /** El ✓ de la etiqueta, el tachado de `@.env` y el sello, de 0 a 1 */
  check: number;
  strike: number;
  stamp: number;
  rule: Rule | null;
};

export type EgressFrame = {
  parcels: ParcelFrame[];
  /** Barrera: 0 baja, 1 arriba */
  arm: number;
  /** Cabezal del escáner sobre su riel (0 a la izquierda, 1 a la derecha) y si alumbra */
  head: number;
  beam: boolean;
  /** La mirada de la aduana sobre la etiqueta */
  sight: number;
  /** La trampa del piso sobre las rechazadas */
  door: number;
  /** La banderita del buzón */
  flag: number;
  arrived: number[];
  withKey: number[];
  refused: number[];
  done: boolean;
};

/** Qué pasa en el segundo `t` con la versión `v` */
export function simulateEgress(v: Version, t: number): EgressFrame {
  const f: EgressFrame = {
    parcels: [],
    arm: 0,
    head: 0,
    beam: false,
    sight: 0,
    door: 0,
    flag: 0,
    arrived: [],
    withKey: [],
    refused: [],
    done: t >= AE_END[v],
  };
  const base = (dep: number, arr: number): ParcelFrame => ({
    from: "agent",
    to: "stop",
    p: ease(span(t, dep, arr)),
    opacity: span(t, dep, dep + 0.2),
    reveal: 0,
    inside: 0,
    check: 0,
    strike: 0,
    stamp: 0,
    rule: null,
  });
  const fade = (a: number, b: number) => Math.min(span(t, a, a + 0.1), 1 - span(t, b - 0.1, b));

  if (v === "v03") {
    PLAN03.forEach((s, i) => {
      const pf = base(s.dep, s.arr);
      pf.check = span(t, s.arr + 0.22, s.arr + 0.47);
      f.sight = Math.max(f.sight, fade(s.arr, s.lift));
      f.arm = Math.max(f.arm, span(t, s.lift, s.lift + LIFT) - span(t, s.go + 0.6, s.go + 0.6 + LIFT));
      if (t >= s.go) Object.assign(pf, { from: "stop", to: "inbox", p: ease(span(t, s.go, s.land)) });
      if (t >= s.land) {
        f.arrived.push(i);
        pf.reveal = 1;
        pf.inside = span(t, s.land, s.land + OPEN);
        if (pf.inside >= 0.5) f.withKey.push(i);
      }
      f.parcels.push(pf);
    });
    f.flag = span(t, PLAN03[0].land, PLAN03[0].land + 0.3);
    return f;
  }

  PLAN04.forEach((s, i) => {
    const pf = base(s.dep, s.arr);
    const rule = REQUESTS[i].stop.v04;
    pf.reveal = span(t, s.arr, s.swept);
    // el cabezal cruza el paquete alumbrando y vuelve a su lugar
    if (t >= s.arr && t < s.swept) Object.assign(f, { head: pf.reveal, beam: true });
    else if (t >= s.swept && t < s.swept + 0.35) f.head = 1 - ease(span(t, s.swept, s.swept + 0.35));
    // sin el valor adentro, la vista del escáner se apaga y queda la etiqueta
    pf.inside = t < s.arr ? 0 : rule === "secret-egress" ? 1 : 1 - span(t, s.swept, s.swept + 0.2);
    if (s.read !== null) {
      f.sight = Math.max(f.sight, fade(s.read, s.stamp + 0.1));
      pf.strike = span(t, s.read + 0.17, s.read + 0.43);
    }
    pf.stamp = span(t, s.stamp, s.stamp + STAMP);
    if (t >= s.stamp) {
      pf.rule = rule;
      f.refused.push(i);
    }
    f.door = Math.max(f.door, span(t, s.drop - 0.1, s.drop + 0.05) - span(t, s.land, s.land + DOOR));
    if (t >= s.drop) Object.assign(pf, { from: "stop", to: "rejected", p: ease(span(t, s.drop, s.land)) });
    f.parcels.push(pf);
  });
  return f;
}

/* ---------- dibujo ---------- */

/** El paquete: caja con tapa, cordel y la etiqueta encima */
export const BW = 136;
export const BH = 46;
/** Ancho de un carácter mono de 10.5px (IBM Plex Mono, 600/1000 em) */
const MONO = 6.3;
/** Paquetes apilados: un poco torcidos, como en una pila de verdad */
const PILE = [
  { dx: -2, deg: -1.3 },
  { dx: 2, deg: 1.1 },
  { dx: -1, deg: -0.7 },
];

export type Box = { x: number; y: number; w: number; h: number };
export type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  start: Pt;
  stop: Pt;
  /** Recorridos del control a cada bandeja; el último punto es el lugar en la pila */
  toInbox: (k: number) => Pt[];
  toRejected: (k: number) => Pt[];
  road: Pt[][];
  ground: [number, number, number][];
  /** Interior de cada bandeja (abiertas arriba) */
  inbox: Box;
  rejected: Box;
  /** Trampa: dos hojas con bisagra en cada punta (solo en el ancho) */
  door: [Pt, Pt] | null;
  /** Arco del escáner: postes a cada lado del paquete y el riel del cabezal */
  arch: { x1: number; x2: number; top: number; bottom: number; lintel: boolean };
  archLabel: { at: Pt; anchor: "middle" | "end" };
  /** Barrera: pivote, largo, hacia dónde apunta y cuánto gira al abrir */
  pivot: Pt;
  armLen: number;
  armDir: 1 | -1;
  liftDeg: number;
  pedestal: Box;
  booth: Box;
  eye: Pt;
  agent: { at: Pt; s: number; label: Pt; anchor: "start" | "end" };
  inboxLabel: Pt;
  rejectedLabel: Pt;
  nothing: Pt;
  flag: Pt | null;
};

const RY = 156;
const WS: Pt = [310, RY - BH / 2];
const wSlot = (x: number, k: number): Pt => [x, 280 - k * 48];
const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 332,
  start: [132, RY - BH / 2],
  stop: WS,
  toInbox: (k) => [WS, [634, WS[1]], wSlot(634, k)],
  toRejected: (k) => [WS, wSlot(310, k)],
  road: [
    [
      [52, RY],
      [232, RY],
    ],
    [
      [388, RY],
      [556, RY],
    ],
  ],
  ground: [
    [56, 226, RY],
    [394, 552, RY],
  ],
  inbox: { x: 558, y: RY, w: 152, h: 148 },
  rejected: { x: 234, y: RY, w: 152, h: 148 },
  door: [
    [232, RY],
    [388, RY],
  ],
  arch: { x1: 230, x2: 390, top: 84, bottom: RY, lintel: true },
  archLabel: { at: [310, 66], anchor: "middle" },
  pivot: [454, RY - 26],
  armLen: 58,
  armDir: -1,
  liftDeg: 82,
  pedestal: { x: 447, y: RY - 30, w: 14, h: 30 },
  booth: { x: 472, y: 62, w: 52, h: RY - 62 },
  eye: [498, 86],
  agent: { at: [4, RY - 36], s: 40, label: [0, RY + 26], anchor: "start" },
  inboxLabel: [634, 328],
  rejectedLabel: [310, 328],
  nothing: [634, 236],
  flag: [712, RY],
};

const NX = 222;
const NY = 150;
const NS: Pt = [NX, NY];
const nSlot = (x: number, k: number): Pt => [x, 348 - k * 48];
const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 398,
  start: [NX, 70],
  stop: NS,
  toInbox: (k) => [NS, nSlot(NX, k)],
  toRejected: (k) => [NS, [70, NY], nSlot(70, k)],
  road: [
    [
      [NX, 44],
      [NX, 224],
    ],
  ],
  ground: [],
  inbox: { x: 152, y: 226, w: 140, h: 146 },
  rejected: { x: 0, y: 226, w: 140, h: 146 },
  door: null,
  arch: { x1: 150, x2: 294, top: 116, bottom: 184, lintel: false },
  archLabel: { at: [132, 108], anchor: "end" },
  pivot: [326, 198],
  armLen: 184,
  armDir: -1,
  liftDeg: -90,
  pedestal: { x: 319, y: 191, w: 14, h: 14 },
  booth: { x: 310, y: 100, w: 52, h: 76 },
  eye: [336, 124],
  agent: { at: [NX - 18, 0], s: 36, label: [NX - 28, 15], anchor: "end" },
  inboxLabel: [NX, 392],
  rejectedLabel: [70, 392],
  nothing: [NX, 300],
  flag: null,
};

/** Punto a una fracción `p` del largo de una polilínea */
export function along(pts: readonly Pt[], p: number): Pt {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let left = p * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, left / lens[i]) : 1;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    left -= lens[i];
  }
  return pts[pts.length - 1];
}

/** Dónde está el paquete y cuánto está torcido (en la pila) */
function parcelAt(G: Geo, pf: ParcelFrame, i: number): { at: Pt; deg: number } {
  if (pf.from === "stop") {
    const route = pf.to === "inbox" ? G.toInbox(i) : G.toRejected(i);
    const [x, y] = along(route, pf.p);
    const k = ease(span(pf.p, 0.75, 1));
    return { at: [x + PILE[i].dx * k, y], deg: PILE[i].deg * k };
  }
  const [x0, y0] = G.start;
  const [x1, y1] = G.stop;
  return { at: [x0 + (x1 - x0) * pf.p, y0 + (y1 - y0) * pf.p], deg: 0 };
}

/** Trazo fino a mano (etiqueta, sello, rayas) */
function thin(pts: readonly Pt[], seed: number, closed = true) {
  return sketch(rng(seed), pts, closed, 0.9, 0.5);
}

/** Lo que lleva adentro: el .env o la key, en rojo */
function Inside({ i, y }: { i: number; y: number }) {
  const text = m.inside[i];
  const w = 14 + 6 + text.length * MONO;
  const x = (BW - w) / 2;
  return (
    <g className="ae-key">
      <Glyph name={i === 0 ? "file" : "key"} x={x} y={y - 8} s={14} />
      <text x={x + 20} y={y + 4} className="ae-inside">
        {text}
      </text>
    </g>
  );
}

/** Sello de goma: cae de más arriba y se queda torcido */
export function Stamp({ text, x, y, s }: { text: string; x: number; y: number; s: number }) {
  const w = text.length * 6 + 14;
  const h = 17;
  const k = 1.7 - 0.7 * ease(s);
  return (
    <g style={{ ...STILL, opacity: Math.min(1, s * 2.5), transform: `translate(${x}px,${y}px) rotate(-6deg) scale(${k})` }}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} className="ae-stamp-bg" />
      <path d={thin(rectPts(-w / 2, -h / 2, w, h), 1301)} className="ae-stamp-out" />
      <rect x={-w / 2 + 2.5} y={-h / 2 + 2.5} width={w - 5} height={h - 5} rx={1} className="ae-stamp-in" />
      <text x={0} y={3.6} textAnchor="middle" className="ae-stamp">
        {text}
      </text>
    </g>
  );
}

/** Etiqueta atada al cordel: herramienta arriba, destino abajo */
const TAG: Pt[] = [
  [10, 11],
  [BW - 18, 11],
  [BW - 18, 41],
  [10, 41],
  [4, 35],
  [4, 17],
];
const CHECK = `M${BW - 33} 18.5L${BW - 28} 23.5L${BW - 20} 12`;
const CHECK_LEN = 18;

export function Parcel({
  i,
  tag,
  inside,
  at,
  deg,
  pf,
  cid,
  k = 1,
}: {
  i: number;
  tag: readonly string[];
  inside: number | null;
  at: Pt;
  deg: number;
  pf: ParcelFrame;
  cid: string;
  /** Escala (la mini del home angosta los dibuja más chicos) */
  k?: number;
}) {
  const [tool, dest] = tag;
  const r = rng(1220 + i);
  const at0 = tool.indexOf(m.pathArg);
  const sx = 18 + at0 * MONO;
  const sw = m.pathArg.length * MONO;
  const stamped = pf.stamp > 0;
  return (
    <g style={{ ...STILL, opacity: pf.opacity, transform: `translate(${at[0]}px,${at[1]}px) rotate(${deg}deg) scale(${k})` }}>
      <g transform={`translate(${-BW / 2} ${-BH / 2})`}>
        <Drawn pts={rectPts(0, 0, BW, BH)} seed={1210 + i} />
        {/* la tapa y el cordel con su moño */}
        <path d={rl(r, 0, 7, BW, 7, 0.8, 0.4)} className="s-ink-thin" />
        <path d={`M${BW / 2} 7V11M${BW / 2} 41V${BH}M0 26H4M${BW - 18} 26H${BW}`} className="s-ink-thin" />
        <path d={`M${BW / 2} 7q-7-9-11-2q4 4 11 2q7-9 11-2q-4 4-11 2`} className="s-ink-thin" />

        <path d={`M${TAG.map((p) => p.join(" ")).join("L")}Z`} className="s-fill" />
        <path d={thin(TAG, 1230 + i)} className="s-ink-thin" />
        <circle cx={11} cy={26} r={2.2} className="ae-hole" />
        <text x={18} y={23} className="ae-tag">
          {tool}
        </text>
        <text x={18} y={36} className="ae-tag">
          {dest}
        </text>
        <path d={CHECK} className="ae-check" style={{ ...STILL, strokeDasharray: CHECK_LEN, strokeDashoffset: CHECK_LEN * (1 - pf.check) }} />
        {at0 >= 0 && (
          <path
            d={`M${sx - 2} 20L${sx + sw + 1} 19`}
            className="ae-strike"
            style={{ ...STILL, strokeDasharray: sw + 4, strokeDashoffset: (sw + 4) * (1 - pf.strike) }}
          />
        )}

        {/* adentro: lo que ve el escáner, o lo que se abre al llegar */}
        <clipPath id={cid}>
          <rect x={-2} y={-2} width={pf.reveal * (BW + 4)} height={BH + 4} />
        </clipPath>
        <g clipPath={`url(#${cid})`} style={{ ...STILL, opacity: pf.inside }}>
          {/* la tapa y el moño quedan: se ve adentro del paquete, no otra cosa */}
          <rect x={1.5} y={8.5} width={BW - 3} height={BH - 10} className="s-fill" />
          <rect x={6} y={11} width={BW - 12} height={BH - 16} rx={2} className="s-guide" />
          {inside !== null && <Inside i={inside} y={stamped ? 21 : 26} />}
        </g>

        {pf.rule && (
          <Stamp text={m.rules[pf.rule]} x={pf.rule === "sh-paths" ? BW - 40 : BW / 2 + 14} y={BH - 2} s={pf.stamp} />
        )}
      </g>
    </g>
  );
}

/** El escáner: postes y riel (detrás del paquete) */
export function Arch({ G, on }: { G: Pick<Geo, "arch" | "archLabel">; on: boolean }) {
  const { x1, x2, top, bottom, lintel } = G.arch;
  const pw = 7;
  return (
    <g style={{ opacity: on ? 1 : 0 }}>
      <Drawn pts={rectPts(x1 - pw, top, pw, bottom - top)} seed={1241} />
      <Drawn pts={rectPts(x2, top, pw, bottom - top)} seed={1242} />
      {lintel ? (
        <Drawn pts={rectPts(x1 - pw - 4, top - 8, x2 - x1 + 2 * pw + 8, 8)} seed={1243} />
      ) : (
        <path d={rl(rng(1244), x1 - pw - 4, top, x2 + pw + 4, top, 0.8, 0.4)} className="s-ink-thin" />
      )}
      <text x={G.archLabel.at[0]} y={G.archLabel.at[1]} textAnchor={G.archLabel.anchor} className="s-lab">
        {m.scanner}
      </text>
    </g>
  );
}

/** El cabezal del escáner: corre por el riel y alumbra el paquete (delante de él) */
export function ScanHead({ G, on, head, beam, w = BW }: { G: Pick<Geo, "arch" | "stop">; on: boolean; head: number; beam: boolean; w?: number }) {
  const { top, bottom } = G.arch;
  const hx = G.stop[0] - w / 2 - 3 + head * (w + 6);
  return (
    <g style={{ opacity: on ? 1 : 0 }}>
      <g style={{ ...STILL, transform: tr(hx, top) }}>
        <path d={`M-3 7V${bottom - top - 2}M3 7V${bottom - top - 2}`} className="ae-beam" style={{ ...STILL, opacity: beam ? 1 : 0 }} />
        <path d="M-10 0h20l-4 7h-12z" className="ae-emitter" />
      </g>
    </g>
  );
}

/** Barrera a rayas sobre su pivote */
export function Barrier({ G, lift }: { G: Pick<Geo, "pivot" | "armLen" | "armDir" | "liftDeg" | "pedestal">; lift: number }) {
  const [px, py] = G.pivot;
  const L = G.armLen;
  const x0 = G.armDir < 0 ? -L : 0;
  const n = Math.floor(L / 18);
  let stripes = "";
  for (let k = 0; k < n; k++) {
    const a = x0 + 5 + k * (L / n);
    stripes += `M${a} 4L${a + 6} 4L${a + 11} -4L${a + 5} -4Z`;
  }
  const P = G.pedestal;
  return (
    <g>
      <Drawn pts={rectPts(P.x, P.y, P.w, P.h)} seed={1251} />
      <g style={{ ...STILL, transform: `translate(${px}px,${py}px) rotate(${G.liftDeg * ease(lift)}deg)` }}>
        <rect x={x0} y={-4} width={L} height={8} className="s-fill" />
        <path d={stripes} className="ae-stripe" />
        <path d={thin(rectPts(x0, -4, L, 8), 1252)} className="s-ink-thin" />
      </g>
      <Node cx={px} cy={py} r={4} />
    </g>
  );
}

/** La caseta de la aduana: cartel, ventana con el ojo y la mirada hacia la etiqueta */
export function Booth({ G, sight, target }: { G: Pick<Geo, "booth" | "eye">; sight: number; target: Pt | null }) {
  const B = G.booth;
  const [ex, ey] = G.eye;
  const sw = m.booth.length * 6.6 + 18;
  const sx = B.x + B.w / 2 - sw / 2;
  return (
    <g>
      <Drawn pts={rectPts(B.x, B.y, B.w, B.h)} seed={1261} />
      <Drawn pts={rectPts(B.x - 6, B.y - 8, B.w + 12, 8)} seed={1262} />
      <path d={`M${sx + 10} ${B.y - 8}V${B.y - 14}M${sx + sw - 10} ${B.y - 8}V${B.y - 14}`} className="s-ink-thin" />
      <Drawn pts={rectPts(sx, B.y - 33, sw, 19)} seed={1264} />
      <text x={B.x + B.w / 2} y={B.y - 19.5} textAnchor="middle" className="ae-sign">
        {m.booth}
      </text>
      <text x={B.x + B.w / 2} y={B.y - 42} textAnchor="middle" className="s-lab">
        {m.boothSub}
      </text>
      <path d={thin(rectPts(ex - 16, ey - 11, 32, 22), 1263)} className="s-ink-thin" />
      <Glyph name="eye" x={ex - 8} y={ey - 8} />
      {target && <path d={`M${ex - 17} ${ey}L${target[0]} ${target[1]}`} className="s-guide" style={{ ...STILL, opacity: sight }} />}
    </g>
  );
}

/** Bandeja abierta arriba: paredes y piso a mano */
export function Tray({ B, seed }: { B: Box; seed: number }) {
  const pts: Pt[] = [
    [B.x - 2, B.y + 2],
    [B.x - 2, B.y + B.h],
    [B.x + B.w + 2, B.y + B.h],
    [B.x + B.w + 2, B.y + 2],
  ];
  return (
    <g>
      <rect x={B.x} y={B.y} width={B.w} height={B.h} className="ae-tray" />
      <path d={sketch(rng(seed), pts, false, 1.4, 0.8)} className="s-ink" />
    </g>
  );
}

/** La banderita del buzón: sube cuando llega algo */
export function Flag({ at, up }: { at: Pt; up: number }) {
  const [x, y] = at;
  return (
    <g>
      <path d={`M${x} ${y}V${y - 36}`} className="s-ink-thin" />
      <g style={{ ...STILL, transform: `translate(${x}px,${y - 36}px) rotate(${-90 + 90 * ease(up)}deg)` }}>
        <path d="M0 0H-20V11H0Z" className="ae-flag" />
      </g>
      <circle cx={x} cy={y - 36} r={2} className="s-node" />
    </g>
  );
}

function Scene({ G, v, f, label }: { G: Geo; v: Version; f: EgressFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const id = useSvgId();
  const target: Pt = [G.stop[0] + BW / 2 - 18, G.stop[1] - BH / 2 + 16];
  const r = rng(1271);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* las dos bandejas: rechazadas, debajo del control, y el buzón de docs.python.org */}
      <Tray B={G.rejected} seed={1281} />
      <Tray B={G.inbox} seed={1282} />
      <text x={G.rejectedLabel[0]} y={G.rejectedLabel[1]} textAnchor="middle" className="s-lab">
        {m.rejected}
      </text>
      <Glyph name="globe" x={G.inboxLabel[0] - 60} y={G.inboxLabel[1] - 12} s={14} />
      <text x={G.inboxLabel[0] + 9} y={G.inboxLabel[1]} textAnchor="middle" className="s-title">
        {m.inbox}
      </text>
      <text x={G.nothing[0]} y={G.nothing[1]} textAnchor="middle" className="ae-none" style={{ opacity: f.done && f.arrived.length === 0 ? 1 : 0 }}>
        {m.nothing}
      </text>
      {G.flag && <Flag at={G.flag} up={f.flag} />}

      {/* el camino y la trampa sobre las rechazadas */}
      {G.road.map((seg, k) => (
        <path key={k} d={sketch(r, seg, false, 1.2, 0.6)} className="s-link" />
      ))}
      {G.ground.map(([a, b, y]) => {
        let d = "";
        for (let x = a + 6; x <= b; x += 12) d += `M${x} ${y + 3}l-5 7`;
        return <path key={a} d={d} className="ae-ground" />;
      })}
      {G.door &&
        G.door.map(([hx, hy], k) => {
          const len = (G.door![1][0] - G.door![0][0]) / 2;
          const dir = k === 0 ? 1 : -1;
          return (
            <g key={k} style={{ ...STILL, transform: `translate(${hx}px,${hy}px) rotate(${dir * 62 * ease(f.door)}deg)` }}>
              <path d={`M0 0H${dir * len}`} className="s-link" />
              <circle r={2.5} className="s-node" />
            </g>
          );
        })}

      {/* la aduana: caseta y barrera; lee la etiqueta */}
      <Booth G={G} sight={f.sight} target={target} />
      <Barrier G={G} lift={f.arm} />

      {/* el agente */}
      <Glyph name="bot" x={G.agent.at[0]} y={G.agent.at[1]} s={G.agent.s} />
      <text x={G.agent.label[0]} y={G.agent.label[1]} textAnchor={G.agent.anchor} className="s-title">
        {m.agent}
      </text>
      <text x={G.agent.label[0]} y={G.agent.label[1] + 16} textAnchor={G.agent.anchor} className="s-lab">
        {m.agentSub}
      </text>

      {/* 0.4.0: el escáner, antes que cualquier otra regla */}
      <Arch G={G} on={v === "v04"} />

      {f.parcels.map((pf, i) => {
        const { at, deg } = parcelAt(G, pf, i);
        // el primero no lleva la key escrita: adentro solo se ve al llegar, cuando curl ya leyó el .env
        const inside = i > 0 || pf.to === "inbox" ? i : null;
        return <Parcel key={i} i={i} tag={m.tags[i]} inside={inside} at={at} deg={deg} pf={pf} cid={`${id}-p${i}`} />;
      })}
      <ScanHead G={G} on={v === "v04"} head={f.head} beam={f.beam} />
    </svg>
  );
}

function result(v: Version, f: EgressFrame) {
  if (f.done) return v === "v04" ? m.results.v04Done : m.results.v03Done;
  return m.results[v];
}

/** Figura: la aduana que lee etiquetas. 0.3.0 deja pasar las tres; 0.4.0 mira adentro */
export function AllowlistEgress({ name, wide, label, caption }: FigureProps) {
  const [v, setV] = useState<Version>("v03");
  const [played, setPlayed] = useState(false);
  const { t, playing, canvas, play, toggle, reset } = usePlayClock(AE_START);
  const seg = useRef<HTMLDivElement>(null);
  const f = simulateEgress(v, Math.min(t, AE_END[v]));

  // al terminar la secuencia el reloj se detiene
  useEffect(() => {
    if (f.done && playing) toggle();
  }, [f.done, playing, toggle]);

  function run(next: Version) {
    setV(next);
    setPlayed(true);
    // con reduced motion se salta al final: se entiende igual
    if (prefersReducedMotion()) {
      if (playing) toggle();
      reset(AE_END[next]);
      return;
    }
    reset(0);
    if (!playing) play();
  }

  function pick(next: Version) {
    if (next !== v) run(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = VERSIONS[(VERSIONS.indexOf(v) + 1) % VERSIONS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
    e.preventDefault();
  }

  const key = f.withKey.length;
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
          <button type="button" className="plain" onClick={() => run(v)}>
            {played ? `↺ ${m.again}` : `▶ ${m.play}`}
          </button>
        </div>
        <div className="counter" aria-hidden="true">
          <span>
            {m.counters.arrived}
            <b className={f.arrived.length > 0 ? "bad" : undefined}>{f.arrived.length}</b>
          </span>
          <span>
            {m.counters.withKey}
            <b className={key > 0 ? "bad" : undefined}>{key}</b>
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


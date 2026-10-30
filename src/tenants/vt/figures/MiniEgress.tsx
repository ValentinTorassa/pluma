"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { along, Arch, Barrier, BH, Booth, BW, ease, Flag, Parcel, ScanHead, span, Tray, type Box, type Geo, type ParcelFrame } from "./AllowlistEgress";
import { frame, rectPts, rl, rng, type Pt } from "./ink";
import { prefersReducedMotion, useSvgId } from "./motion";
import { Drawn, Glyph, Marks, Paper } from "./parts";

const m = copy.figures.miniEgress;

/* ---------- el mismo paquete, dos veces: 0.3.0 lo deja pasar, 0.4.0 lo escanea ---------- */

/** Fin de la pasada por 0.3.0 (el paquete abierto en el buzón) y arranque de 0.4.0 */
const A_END = 3.7;
const B_START = 4.0;
export const MINI_END = 5.7;

export type MiniFrame = { pf: ParcelFrame; v04: boolean; arm: number; head: number; beam: boolean; sight: number; flag: number };

/** Qué muestra la mini en el segundo `t`; en MINI_END queda la respuesta del artículo */
export function miniAt(t: number): MiniFrame {
  const pf: ParcelFrame = {
    from: "agent",
    to: "stop",
    p: 0,
    opacity: 0,
    reveal: 0,
    inside: 0,
    check: 0,
    strike: 0,
    stamp: 0,
    rule: null,
  };
  if (t < B_START) {
    // 0.3.0: la etiqueta está en regla, pasa, y recién en el buzón se ve la key
    pf.p = ease(span(t, 0, 0.8));
    pf.opacity = span(t, 0, 0.15) * (1 - span(t, A_END, B_START));
    pf.check = span(t, 0.85, 1.1);
    if (t >= 1.5) Object.assign(pf, { from: "stop", to: "inbox", p: ease(span(t, 1.5, 2.45)) });
    if (t >= 2.45) Object.assign(pf, { reveal: 1, inside: span(t, 2.45, 2.8) });
    const lower = span(t, A_END, B_START);
    return {
      pf,
      v04: t >= A_END,
      arm: span(t, 1.3, 1.6) - lower,
      head: 0,
      beam: false,
      sight: Math.min(span(t, 0.8, 0.9), 1 - span(t, 1.2, 1.3)),
      flag: span(t, 2.5, 2.8) - lower,
    };
  }
  // 0.4.0: el escáner la encuentra adentro antes de que nadie lea la etiqueta
  pf.p = ease(span(t, B_START, B_START + 0.8));
  pf.opacity = span(t, B_START, B_START + 0.15);
  pf.reveal = span(t, 4.8, 5.35);
  pf.inside = t >= 4.8 ? 1 : 0;
  pf.stamp = span(t, 5.4, 5.62);
  pf.rule = t >= 5.4 ? "secret-egress" : null;
  const sweeping = t >= 4.8 && t < 5.35;
  return { pf, v04: true, arm: 0, head: sweeping ? pf.reveal : 1 - ease(span(t, 5.35, 5.7)), beam: sweeping, sight: 0, flag: 0 };
}

/* ---------- dibujo ---------- */

type MiniGeo = Pick<Geo, "arch" | "archLabel" | "pivot" | "armLen" | "armDir" | "liftDeg" | "pedestal" | "stop"> & {
  narrow: boolean;
  W: number;
  H: number;
  M: number;
  /** Escala del paquete */
  k: number;
  start: Pt;
  toInbox: Pt[];
  road: [Pt, Pt];
  inbox: Box;
  inboxLabel: Pt;
  flag: Pt;
  agent: { at: Pt; s: number } | null;
  /** La caseta con el ojo, o (en angosto) solo el cartel en un poste */
  booth: { booth: Box; eye: Pt } | null;
  sign: Pt | null;
  note: Pt;
};

const WRY = 108;
const WY = WRY - BH / 2;
const WIDE: MiniGeo = {
  narrow: false,
  W: 680,
  H: 150,
  M: 16,
  k: 1,
  start: [110, WY],
  stop: [266, WY],
  toInbox: [
    [266, WY],
    [586, WY],
    [586, 151 - BH / 2],
  ],
  road: [
    [40, WRY],
    [502, WRY],
  ],
  inbox: { x: 508, y: WRY, w: 156, h: 44 },
  inboxLabel: [586, 40],
  flag: [666, WRY],
  arch: { x1: 194, x2: 338, top: 44, bottom: WRY, lintel: true },
  archLabel: { at: [266, 26], anchor: "middle" },
  pivot: [404, WRY - 26],
  armLen: 56,
  armDir: -1,
  liftDeg: 82,
  pedestal: { x: 397, y: WRY - 30, w: 14, h: 30 },
  booth: { booth: { x: 422, y: 50, w: 46, h: WRY - 50 }, eye: [445, 70] },
  agent: { at: [0, WRY - 29], s: 32 },
  sign: null,
  note: [0, 146],
};

const K = 0.8;
const NRY = 88;
const NYC = NRY - (BH * K) / 2;
const NARROW: MiniGeo = {
  narrow: true,
  W: 360,
  H: 168,
  M: 10,
  k: K,
  start: [26, NYC],
  stop: [124, NYC],
  toInbox: [
    [124, NYC],
    [302, NYC],
    [302, 127 - (BH * K) / 2],
  ],
  road: [
    [-10, NRY],
    [242, NRY],
  ],
  inbox: { x: 247, y: NRY, w: 110, h: 40 },
  inboxLabel: [302, 148],
  flag: [359, NRY],
  arch: { x1: 124 - (BW * K) / 2 - 4, x2: 124 + (BW * K) / 2 + 4, top: 34, bottom: NRY, lintel: true },
  archLabel: { at: [124, 16], anchor: "middle" },
  pivot: [222, NRY - 21],
  armLen: 30,
  armDir: -1,
  liftDeg: 82,
  pedestal: { x: 215, y: NRY - 25, w: 14, h: 25 },
  booth: null,
  agent: null,
  sign: [238, 10],
  note: [0, 164],
};

function Scene({ G, f, label }: { G: MiniGeo; f: MiniFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const id = useSvgId();
  const { pf } = f;
  const at: Pt =
    pf.from === "stop"
      ? along(G.toInbox, pf.p)
      : [G.start[0] + (G.stop[0] - G.start[0]) * pf.p, G.start[1] + (G.stop[1] - G.start[1]) * pf.p];
  const target: Pt = [G.stop[0] + (BW / 2 - 18) * G.k, G.stop[1] - (BH / 2 - 16) * G.k];
  const sw = m.booth.length * 6.6 + 18;

  return (
    <svg className={`ink ${G.narrow ? "mini-n" : "mini-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      <Tray B={G.inbox} seed={1481} />
      <Glyph name="globe" x={G.inboxLabel[0] - 60} y={G.inboxLabel[1] - 12} s={14} />
      <text x={G.inboxLabel[0] + 9} y={G.inboxLabel[1]} textAnchor="middle" className="s-title">
        {m.inbox}
      </text>
      <Flag at={G.flag} up={f.flag} />
      <path d={rl(rng(1471), G.road[0][0], G.road[0][1], G.road[1][0], G.road[1][1], 1.2, 0.6)} className="s-link" />

      {G.booth && <Booth G={G.booth} sight={f.sight} target={target} />}
      {G.sign && (
        <g>
          <path d={`M${G.sign[0]} ${G.sign[1] + 19}V${G.pivot[1] + 21}`} className="s-ink-thin" />
          <Drawn pts={rectPts(G.sign[0] - sw / 2, G.sign[1], sw, 19)} seed={1474} />
          <text x={G.sign[0]} y={G.sign[1] + 13.5} textAnchor="middle" className="ae-sign">
            {m.booth}
          </text>
        </g>
      )}
      <Barrier G={G} lift={f.arm} />
      {G.agent && <Glyph name="bot" x={G.agent.at[0]} y={G.agent.at[1]} s={G.agent.s} />}

      <Arch G={G} on={f.v04} />
      <Parcel i={1} tag={copy.figures.allowlistEgress.tags[1]} inside={1} at={at} deg={0} pf={pf} cid={`${id}-mp`} k={G.k} />
      <ScanHead G={G} on={f.v04} head={f.head} beam={f.beam} w={BW * G.k} />

      <text x={G.note[0]} y={G.note[1]} className="s-lab">
        {G.narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: un paquete con la key pasa la aduana de la
 * allowlist porque su etiqueta está en regla, y en 0.4.0 el escáner la
 * encuentra adentro. Queda en esa respuesta (lo que se ve sin JS); al cargar
 * y al pasar el mouse por el link muestra las dos pasadas.
 */
export function MiniEgress({ label }: { label: string }) {
  const [t, setT] = useState(MINI_END);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const play = () => {
      if (prefersReducedMotion()) return;
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const tick = (now: number) => {
        const s = Math.min(MINI_END, (now - t0) / 1000);
        setT(s);
        if (s < MINI_END) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    timer = setTimeout(play, 350);
    const link = root.current?.closest("a");
    link?.addEventListener("mouseenter", play);
    return () => {
      clearTimeout(timer);
      timer = undefined;
      cancelAnimationFrame(raf);
      link?.removeEventListener("mouseenter", play);
    };
  }, []);

  const f = miniAt(t);
  return (
    <div ref={root} className="fig-canvas fig-mini" data-figure="allowlist-egress">
      <Scene G={WIDE} f={f} label={label} />
      <Scene G={NARROW} f={f} label={label} />
      <Marks />
    </div>
  );
}

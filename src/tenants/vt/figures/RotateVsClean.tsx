"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, rl, rng, type Cubic, type Pt } from "./ink";
import { prefersReducedMotion, useTweenNumber } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, type FigureProps } from "./parts";
import { Stepper } from "./Stepper";

const m = copy.figures.rotateVsClean;

type Order = "rotar" | "limpiar";
const ORDERS: Order[] = ["rotar", "limpiar"];

type State = {
  prov: 0 | 1;
  links: number[];
  clean: number[];
  valid: number;
  min: number;
  check?: 1;
  pulse?: 1;
};

const S0: State = { prov: 0, links: [1, 1, 1], clean: [0, 0, 0], valid: 3, min: 0 };
const STATES: Record<Order, State[]> = {
  rotar: [
    S0,
    { prov: 1, links: [0, 0, 0], clean: [0, 0, 0], valid: 0, min: 2 },
    { prov: 1, links: [0, 0, 0], clean: [0, 0, 0], valid: 0, min: 2, check: 1 },
    { prov: 1, links: [0, 0, 0], clean: [1, 0, 0], valid: 0, min: 2, check: 1 },
  ],
  limpiar: [
    S0,
    { prov: 0, links: [0, 1, 1], clean: [1, 0, 0], valid: 2, min: 25 },
    { prov: 0, links: [0, 1, 1], clean: [1, 0, 0], valid: 2, min: 40, pulse: 1 },
    { prov: 1, links: [0, 0, 0], clean: [1, 0, 0], valid: 0, min: 42 },
  ],
};

const GLYPH = ["repo", "fork", "bot"] as const;

type Box = { x: number; y: number; w: number; h: number };
type Geo = { narrow: boolean; M: number; W: number; H: number; prov: Box; copies: Box[]; from: Pt; to: Pt[]; links: Cubic[] };

function geo(g: Omit<Geo, "links">, curve: (a: Pt, b: Pt) => [Pt, Pt, Pt, Pt]): Geo {
  return { ...g, links: g.to.map((b) => cubic(...curve(g.from, b))) };
}

const NARROW_COPIES = [4, 131, 258].map((x) => ({ x, y: 222, w: 118, h: 92 }));
const NARROW = geo(
  {
    narrow: true,
    M: 12,
    W: 380,
    H: 322,
    prov: { x: 90, y: 6, w: 200, h: 112 },
    copies: NARROW_COPIES,
    from: [190, 118],
    to: NARROW_COPIES.map((c): Pt => [c.x + 59, 222]),
  },
  (a, b) => [a, [a[0], a[1] + 56], [b[0], b[1] - 56], b],
);

const WIDE_COPIES = [20, 116, 212].map((y) => ({ x: 470, y, w: 238, h: 76 }));
const WIDE = geo(
  {
    narrow: false,
    M: 20,
    W: 720,
    H: 300,
    prov: { x: 12, y: 92, w: 228, h: 116 },
    copies: WIDE_COPIES,
    from: [240, 150],
    to: WIDE_COPIES.map((c): Pt => [470, c.y + 38]),
  },
  (a, b) => [a, [a[0] + 120, a[1]], [b[0] - 120, b[1]], b],
);

function Chip({ x, y, w, h, kind, text, style }: Box & { kind: "key" | "safe" | "dead"; text: string; style: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx={4} className={`s-tag-${kind}`} />
      <text x={x + 10} y={y + h / 2 + 4} className={`t-${kind}`}>
        {text}
      </text>
      {kind === "dead" && (
        <path
          d={rl(rng(Math.round(x * 7 + y)), x + 7, y + h / 2 + 1, x + 12 + text.length * 7.2, y + h / 2 - 1, 1, 1.4)}
          className="s-strike"
        />
      )}
    </g>
  );
}

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, s, pulse, label }: { G: Geo; s: State; pulse: number[] | null; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const P = G.prov;
  const kw = P.w - 28;
  const chips = G.narrow ? m.chipsNarrow : m.chipsWide;
  const pulsePath = G.links[2];

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      {G.links.map((l, i) => {
        const live = s.links[i] === 1 && !s.prov;
        return (
          <Fragment key={l.d}>
            <path d={l.d} className="s-deadline" />
            <path
              d={l.d}
              className="s-live"
              style={{ strokeDasharray: `${l.dash} ${l.dash}`, strokeDashoffset: live ? 0 : s.clean[i] ? l.dash : -l.dash }}
            />
          </Fragment>
        );
      })}
      <g>
        <Drawn pts={rectPts(P.x, P.y, P.w, P.h)} seed={201} />
        <text x={P.x + 14} y={P.y + 24} className="s-title">
          {m.provider}
        </text>
        <Glyph name="server" x={P.x + P.w - 30} y={P.y + 11} />
        <Chip
          x={P.x + 14}
          y={P.y + 38}
          w={kw}
          h={26}
          kind="key"
          text={m.oldKey}
          style={{ opacity: s.prov ? 0 : 1, transform: s.prov ? "translate(0px,-8px)" : "translate(0px,0px)" }}
        />
        <Chip
          x={P.x + 14}
          y={P.y + 38}
          w={kw}
          h={26}
          kind="safe"
          text={m.newKey}
          style={{ opacity: s.prov ? 1 : 0, transform: s.prov ? "translate(0px,0px)" : "translate(0px,8px)" }}
        />
        <g style={shown(s.check === 1)}>
          <Glyph name="check" x={P.x + 14} y={P.y + 80} s={12} />
          <text x={P.x + 32} y={P.y + 90} className="s-lab">
            {m.checked}
          </text>
        </g>
      </g>
      {G.copies.map((c, i) => {
        const clean = s.clean[i] === 1;
        const dead = !clean && s.prov === 1;
        const chip = { x: c.x + 12, y: c.y + (G.narrow ? 36 : 38), w: c.w - 24, h: 24 };
        return (
          <g key={GLYPH[i]}>
            <Drawn pts={rectPts(c.x, c.y, c.w, c.h)} seed={210 + i} />
            <text x={c.x + 12} y={c.y + 22} className="s-title">
              {m.copies[i][G.narrow ? 1 : 0]}
            </text>
            <Glyph name={GLYPH[i]} x={c.x + c.w - 28} y={c.y + 9} />
            <Chip {...chip} kind="key" text={chips.key} style={shown(!clean && !dead)} />
            <Chip {...chip} kind="dead" text={chips.dead} style={shown(dead)} />
            <Chip {...chip} kind="safe" text={chips.safe} style={shown(clean)} />
          </g>
        );
      })}
      <Node cx={G.from[0]} cy={G.from[1]} r={5.5} />
      {G.to.map(([x, y]) => (
        <Node key={`${x}-${y}`} cx={x} cy={y} r={4.5} />
      ))}
      {[0, 1, 2].map((j) => {
        const q = pulse ? pulse[j] : -1;
        const on = q >= 0 && q <= 1;
        const [cx, cy] = on ? pulsePath.at(pulsePath.length * (1 - q)) : [0, 0];
        return (
          <circle key={j} r={3.5} cx={cx} cy={cy} className="s-pulse" style={{ opacity: on ? Math.sin(q * Math.PI) : 0, transition: "none" }} />
        );
      })}
    </svg>
  );
}

/** Figura C: rotar antes que limpiar; dos órdenes de cuatro pasos y dos contadores */
export function RotateVsClean({ name, wide, label, caption }: FigureProps) {
  const [order, setOrder] = useState<Order>("rotar");
  const [step, setStep] = useState(0);
  const [pulse, setPulse] = useState<{ key: string; q: number[] } | null>(null);
  const seg = useRef<HTMLDivElement>(null);
  const s = STATES[order][step];
  const key = `${order}-${step}`;
  const valid = useTweenNumber(s.valid);
  const minutes = useTweenNumber(s.min);

  // El bot sigue usando la key: tres pulsos viajan del clone al proveedor
  useEffect(() => {
    if (!s.pulse || prefersReducedMotion()) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - t0;
      setPulse({ key, q: [0, 1, 2].map((j) => (t - j * 500) / 1500) });
      if (t < 2600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, s.pulse]);

  const q = pulse && pulse.key === key ? pulse.q : null;

  function pick(next: Order) {
    setOrder(next);
    setStep(0);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = ORDERS[(ORDERS.indexOf(order) + 1) % ORDERS.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-order="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.order} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.orderLabel}</span>
        {ORDERS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={order === o}
            tabIndex={order === o ? 0 : -1}
            data-order={o}
            onClick={() => pick(o)}
          >
            {m.orders[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas">
        <Scene G={WIDE} s={s} pulse={q} label={label} />
        <Scene G={NARROW} s={s} pulse={q} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="counter" aria-hidden="true">
          <span>
            {m.valid}
            <b className={s.valid > 0 ? "bad" : undefined}>{valid}</b>
          </span>
          <span>
            {m.minutes}
            <b className={s.min > 10 ? "bad" : undefined}>{minutes}</b>
          </span>
        </div>
        {/* Los contadores animan; la región viva anuncia solo el valor final */}
        <p className="vh" aria-live="polite">{`${m.valid}: ${s.valid}. ${m.minutes}: ${s.min}.`}</p>
        <Stepper count={4} index={step} label={m.steps[order][step]} onChange={setStep} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

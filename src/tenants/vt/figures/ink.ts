/**
 * Lenguaje de tinta de las figuras (maqueta v3.1): trazos a mano con ruido de
 * una semilla fija, hojas con pliegue, nodos blancos, selección con × en las
 * esquinas y papel cuadriculado con líneas mayores.
 *
 * Funciones puras que devuelven strings de path (o descriptores de formas):
 * la misma semilla da el mismo dibujo en el servidor y en el cliente, así que
 * la hidratación no cambia nada.
 */

export type Pt = readonly [number, number];
export type Rng = () => number;

/** Redondeo a un decimal: paths cortos y estables */
export const fx = (v: number) => Math.round(v * 10) / 10;

/** mulberry32: pseudoaleatorio determinístico a partir de una semilla */
export function rng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Línea "rough": se pasa un poco de las puntas, tiembla y se curva apenas */
export function rl(r: Rng, x1: number, y1: number, x2: number, y2: number, o = 1.4, b = 0.8): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  const s0 = o * (r() * 0.9 + 0.1);
  const s1 = o * (r() * 0.9 + 0.1);
  const j0 = (r() - 0.5) * o * 0.5;
  const j1 = (r() - 0.5) * o * 0.5;
  const bw = (r() - 0.5) * 2 * b * Math.min(1, L / 40);
  return `M${fx(x1 - ux * s0 + px * j0)} ${fx(y1 - uy * s0 + py * j0)}Q${fx((x1 + x2) / 2 + px * bw)} ${fx((y1 + y2) / 2 + py * bw)} ${fx(x2 + ux * s1 + px * j1)} ${fx(y2 + uy * s1 + py * j1)}`;
}

/** Polígono dibujado lado por lado con `rl` */
export function sketch(r: Rng, pts: readonly Pt[], closed: boolean, o?: number, b?: number): string {
  let d = "";
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    d += rl(r, p[0], p[1], q[0], q[1], o, b);
  }
  return d;
}

/** Relleno limpio (debajo del trazo a mano) */
export const poly = (pts: readonly Pt[]) => `M${pts.map((p) => `${fx(p[0])} ${fx(p[1])}`).join("L")}Z`;

export const rectPts = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Hoja con la esquina superior derecha doblada */
export const sheetPts = (x: number, y: number, w: number, h: number, f: number): Pt[] => [
  [x, y],
  [x + w - f, y],
  [x + w, y + f],
  [x + w, y + h],
  [x, y + h],
];

/** Forma dibujada: relleno blanco + trazo; con `fold`, el pliegue de la hoja */
export function drawn(
  pts: readonly Pt[],
  seed: number,
  { fold = 0, o = 1.4, b = 0.8 }: { fold?: number; o?: number; b?: number } = {},
): { fill: string; ink: string } {
  const r = rng(seed);
  let ink = sketch(r, pts, true, o, b);
  if (fold) {
    const [x, y] = pts[1];
    ink += rl(r, x, y, x, y + fold, 0.5, 0.2) + rl(r, x, y + fold, x + fold, y + fold, 0.5, 0.2);
  }
  return { fill: poly(pts), ink };
}

export const xmark = (x: number, y: number, s = 3.5) =>
  `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`;

/** Papel cuadriculado: `minor` cada `step`, `major` cada `major` pasos desde (ox, oy) */
export function paper(
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  ox = 0,
  oy = 0,
  major = 5,
): { minor: string; major: string } {
  let a = "";
  let m = "";
  const md = (i: number) => ((i % major) + major) % major === 0;
  for (let i = Math.ceil((x - ox) / step); ox + i * step <= x + w; i++) {
    const X = fx(ox + i * step);
    const s = `M${X} ${y}V${y + h}`;
    if (md(i)) m += s;
    else a += s;
  }
  for (let i = Math.ceil((y - oy) / step); oy + i * step <= y + h; i++) {
    const Y = fx(oy + i * step);
    const s = `M${x} ${Y}H${x + w}`;
    if (md(i)) m += s;
    else a += s;
  }
  return { minor: a, major: m };
}

export type ViewBox = readonly [number, number, number, number];

/** viewBox con margen M alrededor de la escena W×H */
export function frame(W: number, H: number, M: number): { viewBox: string; vb: ViewBox } {
  const vb = [-M, -M, W + 2 * M, H + 2 * M] as const;
  return { viewBox: vb.join(" "), vb };
}

export type GlyphShape = { d: string } | { cx: number; cy: number; r: number; cls: "dot" | "nd" };

/** Glifos de 16×16 (se escalan con `s`) */
export const GLYPHS = {
  eye: [{ d: "M1 8Q8 1.5 15 8Q8 14.5 1 8Z" }, { cx: 8, cy: 8, r: 2.2, cls: "dot" }],
  bot: [
    { d: "M3 5.5h10v8.5H3zM8 5.5V3M1 9v2.5M15 9v2.5" },
    { cx: 8, cy: 2.2, r: 1.1, cls: "dot" },
    { cx: 6, cy: 9.6, r: 1.1, cls: "dot" },
    { cx: 10, cy: 9.6, r: 1.1, cls: "dot" },
  ],
  server: [
    { d: "M2 2.5h12v5H2zM2 9h12v5H2z" },
    { cx: 4.8, cy: 5, r: 0.9, cls: "dot" },
    { cx: 4.8, cy: 11.5, r: 0.9, cls: "dot" },
  ],
  fork: [
    { d: "M4 5v1.5Q4 9.5 8 10.2Q12 9.5 12 6.5V5M8 10.2V11.2" },
    { cx: 4, cy: 3.2, r: 1.8, cls: "nd" },
    { cx: 12, cy: 3.2, r: 1.8, cls: "nd" },
    { cx: 8, cy: 13, r: 1.8, cls: "nd" },
  ],
  repo: [{ d: "M3.5 2.5h9.5v11H4.8Q3.5 13.5 3.5 12.2ZM3.5 12.2Q3.5 11 4.8 11H13" }],
  check: [{ d: "M2 8.5l3.5 3.5L14 3.5" }],
  file: [{ d: "M3 1.5h6.5L13 5v9.5H3zM9.5 1.5V5H13" }],
  laptop: [{ d: "M3 3.5h10v7.5H3zM1 13h14" }],
  globe: [{ d: "M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM1.5 8h13M8 1.5Q4.2 8 8 14.5M8 1.5Q11.8 8 8 14.5" }],
} as const satisfies Record<string, readonly GlyphShape[]>;

export type GlyphName = keyof typeof GLYPHS;

/**
 * Curva cúbica con largo aproximado y punto por distancia recorrida (lo que en
 * el navegador dan getTotalLength/getPointAtLength, pero también en el servidor).
 */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, samples = 96) {
  const pt = (t: number): Pt => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
  const lens = [0];
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const q = pt(i / samples);
    lens.push(lens[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]));
    prev = q;
  }
  const length = lens[samples];
  const at = (s: number): Pt => {
    const target = Math.max(0, Math.min(length, s));
    let i = 1;
    while (i < samples && lens[i] < target) i++;
    const seg = lens[i] - lens[i - 1] || 1;
    return pt((i - 1 + (target - lens[i - 1]) / seg) / samples);
  };
  return {
    d: `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`,
    /** Entero y un poco más largo que la curva: sirve de dasharray sin dejar un punto visible */
    dash: Math.ceil(length) + 1,
    length,
    at,
  };
}

export type Cubic = ReturnType<typeof cubic>;

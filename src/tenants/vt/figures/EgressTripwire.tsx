"use client";

import { useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, type Pt } from "./ink";
import { Drawn, FigureFrame, Marks, Paper, SelBox, type FigureProps } from "./parts";
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
/** El cuadro inicial: el límite del que habla la sección */
const START: Preset = "split";
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

/** La request entera (lo que revisa el firewall) y dónde cae el valor en la línea del query */
export function request(p: Preset, value: string, host: string) {
  const query = `?${payload(p, value)}`;
  const match = detect(`${host}${query}`, value);
  const at = match && (match.decoded ? { start: 3, end: query.length } : { start: match.start - host.length, end: match.end - host.length });
  return { query, match, at };
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  env: Box;
  looks: Pt;
  rows: number[];
  note: Pt;
  req: Box;
  host: string;
  verdict: Box;
  /** Caracteres del query que entran en la línea */
  fit: number;
};

const CHAR = 7.2;
const FORMS: Form[] = ["plain", "base64", "hex"];

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 196,
  env: { x: 0, y: 0, w: 236, h: 68 },
  looks: [0, 96],
  rows: [118, 138, 158],
  note: [0, 182],
  req: { x: 276, y: 0, w: 444, h: 118 },
  host: m.host,
  verdict: { x: 276, y: 140, w: 0, h: 26 },
  fit: 57,
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 346,
  env: { x: 0, y: 0, w: 236, h: 68 },
  looks: [0, 96],
  rows: [118, 138, 158],
  note: [0, 182],
  req: { x: 0, y: 204, w: 380, h: 100 },
  host: m.hostNarrow,
  verdict: { x: 0, y: 318, w: 0, h: 26 },
  fit: 48,
};

/** El texto de cada forma en la lista, recortado a lo que entra en la columna */
function formText(form: Form, value: string): string {
  const data = bytesOf(value);
  const text = form === "plain" ? value : form === "hex" ? hexOf(data) : b64(data).slice(0, Math.floor((8 * data.length) / 6));
  return text.length > 25 ? `${text.slice(0, 20)}…` : text;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Aparece después del barrido, escalonado; se va sin esperar */
const later = (on: boolean, ms: number): CSSProperties => ({ opacity: on ? 1 : 0, transitionDelay: on ? `${ms}ms` : "0ms" });

function Scene({ G, preset, scan, label }: { G: Geo; preset: Preset; scan: number; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { env: E, req: R } = G;
  const px = R.x + 14;
  const py = R.y + 84;
  const all = PRESETS.map((p) => ({ p, ...request(p, m.value, m.host) }));
  const cur = all.find((x) => x.p === preset)!;
  const denyW = m.verdicts.deny.length * CHAR + 18;
  const allowW = m.verdicts.allow.length * CHAR + 18;
  const noteX = (on: boolean) => G.verdict.x + (on ? denyW : allowW) + 12;
  const scanW = Math.min(cur.query.length, G.fit) * CHAR;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* el .env y lo que el firewall precalcula de su valor */}
      <Drawn pts={sheetPts(E.x, E.y, E.w, E.h, 10)} seed={1301} fold={10} />
      <text x={E.x + 12} y={E.y + 20} className="s-file">
        {m.env}
      </text>
      <text x={E.x + 12} y={E.y + 38} className="s-file">
        {m.envKey}
      </text>
      <g className="is-key">
        <rect x={E.x + 6} y={E.y + 44} width={E.w - 12} height={19} rx={3} className="s-keybg" />
        <text x={E.x + 12} y={E.y + 58} className="s-file">
          {m.value}
        </text>
      </g>
      <text x={G.looks[0]} y={G.looks[1]} className="s-lab">
        {m.looks}
      </text>
      {FORMS.map((form, i) => {
        const on = cur.match?.form === form;
        return (
          <g key={form}>
            <text x={0} y={G.rows[i]} className="s-lab">
              {m.forms[form]}
            </text>
            <text x={64} y={G.rows[i]} className={on ? "et-form on" : "et-form"} style={{ transitionDelay: on ? "450ms" : "0ms" }}>
              {formText(form, m.value)}
            </text>
          </g>
        );
      })}
      <text x={G.note[0]} y={G.note[1]} className="s-lab">
        {m.formsNote}
      </text>

      {/* la request que sale */}
      <Drawn pts={rectPts(R.x, R.y, R.w, R.h)} seed={1302} />
      <text x={R.x + 14} y={R.y + 24} className="s-title">
        {m.tool}
      </text>
      <text x={R.x + 14} y={R.y + 48} className="s-file">
        {G.host}
      </text>
      {all.map(({ p, query }) => (
        <text key={p} x={px} y={py} className="et-pay" style={{ opacity: p === preset ? 1 : 0 }}>
          {clip(query, G.fit)}
        </text>
      ))}

      {/* dónde coincidió, y con qué forma */}
      {all.map(({ p, match, at }) => {
        if (!match || !at) return null;
        const on = p === preset;
        const start = Math.min(at.start, G.fit - 1);
        const end = Math.min(at.end, G.fit);
        const x = px + start * CHAR - 4;
        const w = (end - start) * CHAR + 8;
        const row = G.rows[FORMS.indexOf(match.form)];
        const mid = x + w / 2;
        // en angosto baja por la derecha, para no cruzar la URL, y entra por arriba de la marca
        const guide = G.narrow
          ? cubic([E.x + 232, row - 4], [350, row - 4], [350, py - 40], [Math.max(x + 12, Math.min(x + w - 16, 356)), py - 18])
          : cubic([E.x + 232, row - 4], [256, row - 4], [mid, R.y + R.h + 14], [mid, py + 10]);
        return (
          <g key={p}>
            <g style={later(on, 450)}>
              <SelBox x={x} y={py - 18} w={w} h={24} />
            </g>
            <path d={guide.d} className="s-guide" style={later(on, 560)} />
          </g>
        );
      })}

      {/* el barrido: solo cuando el lector cambia la forma */}
      {scan > 0 && (
        <g key={scan} className="et-scan" style={{ "--et-w": `${scanW}px` } as CSSProperties}>
          <path d={`M${px} ${py - 20}V${py + 8}`} className="et-cursor" />
        </g>
      )}

      {/* el veredicto */}
      <g style={later(cur.match !== null, 670)}>
        <rect x={G.verdict.x} y={G.verdict.y} width={denyW} height={G.verdict.h} rx={4} className="s-tag-safe" />
        <text x={G.verdict.x + 9} y={G.verdict.y + 17} className="t-safe">
          {m.verdicts.deny}
        </text>
      </g>
      <g style={later(cur.match === null, 670)}>
        <rect x={G.verdict.x} y={G.verdict.y} width={allowW} height={G.verdict.h} rx={4} className="s-tag-key" />
        <text x={G.verdict.x + 9} y={G.verdict.y + 17} className="t-key">
          {m.verdicts.allow}
        </text>
      </g>
      {all.map(({ p, match }) => (
        <text key={p} x={noteX(match !== null)} y={G.verdict.y + 17} className="s-lab" style={later(p === preset, 670)}>
          {match ? m.matched(match.decoded ? `${m.forms[match.form]}, ${m.decoded}` : m.forms[match.form]) : m.unmatched}
        </text>
      ))}
    </svg>
  );
}

/** Figura: las formas de mandar la key que secret-egress reconoce, y las que no */
export function EgressTripwire({ name, wide, label, caption }: FigureProps) {
  const [preset, setPreset] = useState<Preset>(START);
  const [scan, setScan] = useState(0);

  function pick(p: Preset) {
    if (p === preset) return;
    setPreset(p);
    setScan((n) => n + 1);
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} preset={preset} scan={scan} label={label} />
        <Scene G={NARROW} preset={preset} scan={scan} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="presets" role="group" aria-label={m.presetsLabel}>
          <span className="muted">{m.try}</span>
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={preset === p} onClick={() => pick(p)}>
              {m.presets[p]}
            </button>
          ))}
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(m.results[preset])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

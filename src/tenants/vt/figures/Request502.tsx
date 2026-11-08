"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { copy } from "../messages";
import { frame, GLYPHS, rectPts, xmark, type Pt } from "./ink";
import { Drawn, FigureFrame, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { Stepper } from "./Stepper";

const m = copy.figures.request502;

export type Case = keyof typeof m.cases;
export const CASES: Case[] = ["port", "bind"];
/** Dónde está escuchando la app (demo/README.md, fallas 3 y 4) */
export type Iface = "eth" | "lo";

/* ---------- el modelo ---------- */

/** El puerto al que Nginx manda la request (proxy_pass) */
export const UPSTREAM: Record<Case, number> = { port: 8000, bind: 3000 };
/** La app escucha en el 3000: en 0.0.0.0 (todas las interfaces del contenedor) o solo en 127.0.0.1 */
export const LISTEN_PORT = 3000;
export const LISTENS: Record<Case, readonly Iface[]> = { port: ["eth", "lo"], bind: ["lo"] };

/** ¿Alguien contesta en ese puerto de esa interfaz del contenedor de la app? */
export function answers(c: Case, port: number, iface: Iface): boolean {
  return port === LISTEN_PORT && LISTENS[c].includes(iface);
}

/** Nginx llega por la red de Docker: a la interfaz 172.18.0.2, nunca al 127.0.0.1 del otro contenedor */
export const refused = (c: Case) => !answers(c, UPSTREAM[c], "eth");
/** La prueba desde el proxy a app:3000 */
export const probeAnswers = (c: Case) => answers(c, LISTEN_PORT, "eth");

/** Pasos del stepper: el primero muestra lo que es igual; cada uno de los otros, una diferencia */
export const STEPS = m.diffRows.length + 1;

export type DiffFrame = {
  /** Cuántas filas de diferencias ya se ven */
  rows: number;
  /** El puerto en la flecha de Nginx */
  port: boolean;
  /** El proxy_pass adentro del proxy */
  proxyPass: boolean;
  /** Dónde escucha la app */
  listen: boolean;
  /** La prueba desde el proxy */
  probe: boolean;
};

export function diffAt(step: number): DiffFrame {
  const k = Math.max(0, Math.min(STEPS - 1, step));
  return { rows: k, port: k >= 1, proxyPass: k >= 2, listen: k >= 3, probe: k >= 4 };
}

/** Marcas de las filas: <bad> la causa, <ok> lo que está bien, <em> lo que cambia */
const MARK = /<(bad|ok|em)>(.*?)<\/\1>/g;

/** El texto tal como salió del lab, sin las marcas */
export const plain = (text: string) => text.replace(MARK, "$2");

function marked(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARK)) {
    const [whole, tag, inner] = match;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <b key={match.index} className={`r5-mark ${tag}`}>
        {inner}
      </b>,
    );
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ---------- dibujo ---------- */

type Geo = { narrow: boolean; M: number; W: number; H: number; at: Record<Case, Pt> };

const WIDE: Geo = { narrow: false, M: 20, W: 720, H: 176, at: { port: [0, 0], bind: [380, 0] } };
const NARROW: Geo = { narrow: true, M: 12, W: 380, H: 372, at: { port: [20, 0], bind: [20, 196] } };

/** Medidas de cada caso, desde su esquina (los dos miden 340 × 176) */
const PROXY = { x: 14, y: 40, w: 102, h: 110 };
const APP = { x: 186, y: 40, w: 140, h: 112 };
const LO = { x: 196, y: 110, w: 122, h: 34 };
const MAIN_Y = 80;
const PROBE_Y = 98;
const CHIP = { x: 278, w: 40, h: 17 };
const ROW_Y: Record<Iface, number> = { eth: 90, lo: 131 };

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Chip({ y, on, bad }: { y: number; on: boolean; bad: boolean }) {
  return (
    <g style={shown(on)}>
      <rect x={CHIP.x} y={y - 12.5} width={CHIP.w} height={CHIP.h} rx={3} className={bad ? "rq-chip bad" : "rq-chip"} />
      <text x={CHIP.x + CHIP.w / 2} y={y} textAnchor="middle" className={bad ? "rq-val bad" : "rq-val"}>
        {m.diagram.listen}
      </text>
    </g>
  );
}

function CaseDiagram({ c, s, seed }: { c: Case; s: DiffFrame; seed: number }) {
  const d = m.diagram;
  const ok = probeAnswers(c);
  return (
    <g>
      <text x={0} y={13} className="s-title">
        {m.cases[c]}
      </text>
      <rect x={0} y={26} width={340} height={150} rx={6} className="s-sel" />
      <text x={12} y={168} className="s-lab">
        {d.net}
      </text>

      {/* el contenedor del proxy */}
      <Drawn pts={rectPts(PROXY.x, PROXY.y, PROXY.w, PROXY.h)} seed={seed} />
      <text x={PROXY.x + 12} y={PROXY.y + 22} className="s-title">
        {d.proxy}
      </text>
      <text x={PROXY.x + 12} y={PROXY.y + 39} className="s-lab">
        {d.proxySub}
      </text>
      <g style={shown(s.proxyPass)}>
        <text x={PROXY.x + 12} y={PROXY.y + 78} className="s-lab s-mono">
          {d.proxyPass}
        </text>
        <text x={PROXY.x + 12} y={PROXY.y + 96} className={c === "port" ? "rq-val bad" : "rq-val"}>
          {d.pass[c]}
        </text>
      </g>

      {/* el contenedor de la app: su interfaz en la red de Docker y su propio localhost */}
      <Drawn pts={rectPts(APP.x, APP.y, APP.w, APP.h)} seed={seed + 1} />
      <text x={APP.x + 12} y={APP.y + 22} className="s-title">
        {d.app}
        <tspan className="s-lab" dx={6}>
          {d.appSub}
        </tspan>
      </text>
      <text x={APP.x + 12} y={ROW_Y.eth} className="s-lab s-mono">
        {d.eth}
      </text>
      <rect x={LO.x} y={LO.y} width={LO.w} height={LO.h} rx={4} className="sd-ghost" />
      <text x={LO.x + 10} y={ROW_Y.lo} className="s-lab s-mono">
        {d.lo}
      </text>
      <Chip y={ROW_Y.eth} on={s.listen && LISTENS[c].includes("eth")} bad={false} />
      <Chip y={ROW_Y.lo} on={s.listen && LISTENS[c].includes("lo")} bad={c === "bind"} />
      <path d={`M${APP.x} ${MAIN_Y - 8}V${PROBE_Y + 6}`} className="s-chain" />

      {/* la request de Nginx: nadie contesta en ese puerto de 172.18.0.2 */}
      <path d={`M${PROXY.x + PROXY.w} ${MAIN_Y}H${APP.x}`} className="s-link" />
      <text x={(PROXY.x + PROXY.w + APP.x) / 2} y={MAIN_Y - 8} textAnchor="middle" className={c === "port" ? "rq-val bad" : "rq-val"} style={shown(s.port)}>
        {d.upstream[c]}
      </text>
      <circle cx={APP.x} cy={MAIN_Y} r={7} className="s-fill" />
      <path d={xmark(APP.x, MAIN_Y, 4.5)} className="s-x-bad" style={shown(refused(c))} />

      {/* la prueba desde el proxy a app:3000 */}
      <g style={shown(s.probe)}>
        <path d={`M${PROXY.x + PROXY.w} ${PROBE_Y}H${APP.x}`} className="s-guide" />
        <text x={(PROXY.x + PROXY.w + APP.x) / 2} y={PROBE_Y + 16} textAnchor="middle" className="s-lab s-mono">
          {d.probe}
        </text>
        <circle cx={APP.x} cy={PROBE_Y} r={8} className="s-fill" />
        {ok ? (
          <path d={GLYPHS.check[0].d} transform={`translate(${APP.x - 6} ${PROBE_Y - 6}) scale(0.75)`} className="jw-mark-ok" />
        ) : (
          <path d={xmark(APP.x, PROBE_Y, 4.5)} className="s-x-bad" />
        )}
      </g>
    </g>
  );
}

function Scene({ G, s, label }: { G: Geo; s: DiffFrame; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />
      {CASES.map((c, i) => (
        <g key={c} transform={`translate(${G.at[c][0]} ${G.at[c][1]})`}>
          <CaseDiagram c={c} s={s} seed={1401 + i * 2} />
        </g>
      ))}
    </svg>
  );
}

/** Las salidas del lab, en HTML para que corten en el celular: lo igual una vez, lo distinto lado a lado */
function Compare({ s }: { s: DiffFrame }) {
  return (
    <div className="r5-out">
      <div className="r5-head" aria-hidden="true">
        {CASES.map((c) => (
          <span key={c}>{m.cases[c]}</span>
        ))}
      </div>
      {m.sameRows.map((row) => (
        <div key={row.label} className="r5-row" data-kind="same">
          <span className="r5-label">{row.label}</span>
          <span className="r5-both">
            <code>
              {row.lines.map((line, j) => (
                <span key={j} className="r5-ln">
                  {line}
                </span>
              ))}
            </code>
            <span className="r5-same">{m.same}</span>
          </span>
        </div>
      ))}
      {m.diffRows.map((row, i) => (
        <div key={row.label} className="r5-row" data-kind="diff" data-shown={i < s.rows} data-current={i === s.rows - 1}>
          <span className="r5-label">{row.label}</span>
          {CASES.map((c) => (
            <span key={c} className="r5-cell" aria-hidden={i >= s.rows}>
              <span className="r5-case">{m.cases[c]}</span>
              <code>{marked(row[c])}</code>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Figura: los dos 502 del lab lado a lado; lo igual primero y, paso a paso, lo que los separa */
export function Request502({ name, wide, label, caption }: FigureProps) {
  const [step, setStep] = useState(0);
  const s = diffAt(step);
  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} s={s} label={label} />
        <Scene G={NARROW} s={s} label={label} />
        <Compare s={s} />
        <Marks />
      </div>
      <div className="fig-foot">
        <Stepper count={STEPS} index={step} label={rich(m.steps[step])} onChange={setStep} />
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

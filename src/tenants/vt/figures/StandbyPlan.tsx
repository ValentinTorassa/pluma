"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, xmark, type Cubic, type Pt } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, FigureFrame, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";
import { TfOutput } from "./TfOutput";

const m = copy.figures.standbyPlan;

export type PlanCase = keyof typeof m.modes;
export const CASES: PlanCase[] = ["igual", "puerto", "politica", "prendida", "credencial"];
export type Row = keyof typeof m.rows;
export const ROWS: Row[] = ["sg", "role", "instance"];

/* ---------- el modelo ---------- */

/**
 * Qué cambió alguien a mano en la cuenta. Cada uno lo ve el plan porque
 * Terraform es dueño de eso: las reglas del grupo van dentro del recurso, las
 * políticas del rol son exclusivas y el estado de la instancia es un recurso.
 */
export const DRIFT: Record<PlanCase, Row | null> = {
  igual: null,
  puerto: "sg",
  politica: "role",
  prendida: "instance",
  credencial: null,
};

/** El recurso del módulo que muestra la diferencia en el plan */
export const RESOURCE: Record<Row, string> = {
  sg: "module.standby.aws_security_group.standby",
  role: "module.standby.aws_iam_role_policy_attachments_exclusive.standby",
  instance: "module.standby.aws_ec2_instance_state.standby",
};

/** Código de `terraform plan -detailed-exitcode`: 0 igual, 2 drift, 1 no pudo correr */
export type ExitCode = 0 | 1 | 2;
export function exitCode(c: PlanCase): ExitCode {
  if (c === "credencial") return 1;
  return DRIFT[c] ? 2 : 0;
}

/** Lo que muestra Gatus: verde solo con 0; con 1 también rojo, pero con otro mensaje */
export type Light = keyof typeof m.status;
export const lightFor = (code: ExitCode): Light => (code === 0 ? "green" : code === 2 ? "drift" : "failed");

export type RowState = keyof typeof m.marks;
/** Cómo compara el plan cada fila. Si no pudo leer la cuenta, no sabe nada de ninguna */
export function rowState(c: PlanCase, row: Row): RowState {
  if (exitCode(c) === 1) return "unknown";
  return DRIFT[c] === row ? "drift" : "same";
}

/** Lo que hay en la cuenta: lo mismo que el código, más lo agregado a mano (o la instancia prendida) */
export function accountRow(c: PlanCase, row: Row): { value: string; added: string | null } {
  if (rowState(c, row) !== "drift") return { value: m.values[row], added: null };
  return row === "instance" ? { value: m.drift.instance, added: null } : { value: m.values[row], added: m.drift[row] };
}

/** Hasta dónde llega la lectura de la cuenta cuando la credencial venció */
export const CUT = 0.5;

/** Ancho de una etiqueta en mono de 10,5 px */
export const chipWidth = (text: string) => Math.round(text.length * 6.7 + 12);

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Anchor = "start" | "middle" | "end";
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  acct: Box;
  code: Box;
  /** En la angosta el subtítulo de cada caja va debajo del título */
  subBelow: boolean;
  /** Renglones de una fila: rótulo, valor, lo agregado a mano y el centro (para la marca) */
  row: (i: number) => { label: number; value: number; chip: number; mid: number };
  /** Lo agregado a mano va a la derecha del rótulo (ancha) o en su propio renglón (angosta) */
  chipRight: boolean;
  markX: number;
  plan: Box;
  readA: Cubic;
  readB: Cubic;
  cutLabel: { x: number; y: number; anchor: Anchor };
  exit: { from: Pt; to: Pt; label: Pt; anchor: Anchor };
  light: Pt;
  gatus: { name: Pt; status: Pt; anchor: Anchor };
  note: Pt;
};

const PAD = 12;

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 266,
  acct: { x: 0, y: 0, w: 290, h: 166 },
  code: { x: 430, y: 0, w: 290, h: 166 },
  subBelow: false,
  row: (i) => {
    const label = 56 + i * 40;
    return { label, value: label + 16, chip: label, mid: label + 5 };
  },
  chipRight: true,
  markX: 360,
  plan: { x: 250, y: 206, w: 220, h: 50 },
  readA: cubic([200, 166], [200, 190], [300, 182], [300, 206]),
  readB: cubic([520, 166], [520, 190], [420, 182], [420, 206]),
  cutLabel: { x: 236, y: 199, anchor: "end" },
  exit: { from: [470, 231], to: [622, 231], label: [546, 222], anchor: "middle" },
  light: [644, 231],
  gatus: { name: [644, 203], status: [644, 264], anchor: "middle" },
  note: [0, 232],
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 364,
  acct: { x: 0, y: 0, w: 170, h: 204 },
  code: { x: 210, y: 0, w: 170, h: 204 },
  subBelow: true,
  row: (i) => {
    const label = 64 + i * 54;
    return { label, value: label + 16, chip: label + 32, mid: label + 5 };
  },
  chipRight: false,
  markX: 190,
  plan: { x: 90, y: 240, w: 200, h: 50 },
  readA: cubic([85, 204], [85, 224], [150, 220], [150, 240]),
  readB: cubic([295, 204], [295, 224], [230, 220], [230, 240]),
  cutLabel: { x: 80, y: 230, anchor: "end" },
  exit: { from: [190, 290], to: [190, 326], label: [200, 314], anchor: "start" },
  light: [190, 346],
  gatus: { name: [214, 342], status: [214, 359], anchor: "start" },
  note: [0, 314],
};

const SEEDS = { acct: 1601, code: 1602, plan: 1603 };

type Phase = "start" | "go";

/** Un trazo que se dibuja hasta `p` (0 a 1) después de `delay` segundos */
function stroke(len: number, p: number, phase: Phase, delay: number): CSSProperties {
  return {
    strokeDasharray: `${len} ${len}`,
    strokeDashoffset: phase === "go" ? len * (1 - p) : len,
    transitionDelay: phase === "go" ? `${delay}s` : "0s",
  };
}

/** Lo que aparece cuando el plan ya leyó: con demora, y solo si `on` */
function after(phase: Phase, delay: number, on = true): CSSProperties {
  const visible = phase === "go" && on;
  return { opacity: visible ? 1 : 0, transitionDelay: visible ? `${delay}s` : "0s" };
}

/** Cuándo pasa cada cosa después de elegir un caso (segundos) */
const T = { marks: 0.8, exit: 1.2, light: 1.8 };

function BoxTitle({ G, b, title, sub, seed }: { G: Geo; b: Box; title: string; sub: string; seed: number }) {
  return (
    <>
      <Drawn pts={rectPts(b.x, b.y, b.w, b.h)} seed={seed} />
      <text x={b.x + PAD} y={b.y + 24} className="s-title">
        {title}
        {!G.subBelow && (
          <tspan className="s-lab" dx={6}>
            {sub}
          </tspan>
        )}
      </text>
      {G.subBelow && (
        <text x={b.x + PAD} y={b.y + 40} className="s-lab">
          {sub}
        </text>
      )}
    </>
  );
}

function Chip({ G, x, y, text, on }: { G: Geo; x: number; y: number; text: string; on: boolean }) {
  const w = chipWidth(text);
  const left = G.chipRight ? x - w : x;
  return (
    <g className="sb-chip" style={{ opacity: on ? 1 : 0 }}>
      <rect x={left} y={y - 11} width={w} height={15} rx={3} />
      <text x={left + w / 2} y={y} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function Scene({ G, c, phase, label }: { G: Geo; c: PlanCase; phase: Phase; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const code = exitCode(c);
  const failed = code === 1;
  const lit = lightFor(code);
  const { acct, code: mod, plan } = G;
  const cutAt = G.readA.at(G.readA.length * CUT);
  const [ex0, ex1] = [G.exit.from, G.exit.to];
  const exitLen = Math.hypot(ex1[0] - ex0[0], ex1[1] - ex0[1]);
  const dir: Pt = [(ex1[0] - ex0[0]) / exitLen, (ex1[1] - ex0[1]) / exitLen];
  const head = `M${ex1[0] - dir[0] * 7 - dir[1] * 4} ${ex1[1] - dir[1] * 7 + dir[0] * 4}L${ex1[0]} ${ex1[1]}L${ex1[0] - dir[0] * 7 + dir[1] * 4} ${ex1[1] - dir[1] * 7 - dir[0] * 4}`;
  const chipX = (b: Box) => (G.chipRight ? b.x + b.w - PAD : b.x + PAD);

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}${phase === "start" ? " still" : ""}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      {/* lo que lee el plan: la cuenta (se corta si la credencial venció) y el código */}
      <path d={G.readA.d} className="s-guide" />
      <path d={G.readB.d} className="s-guide" />
      <path d={G.readA.d} className="s-link" style={stroke(G.readA.dash, failed ? CUT : 1, phase, 0)} />
      <path d={G.readB.d} className="s-link" style={stroke(G.readB.dash, 1, phase, 0)} />
      <path d={xmark(cutAt[0], cutAt[1], 5.5)} className="s-x-bad" style={after(phase, 0.9, failed)} />
      <text x={G.cutLabel.x} y={G.cutLabel.y} textAnchor={G.cutLabel.anchor} className="sb-cut" style={after(phase, 0.9, failed)}>
        {m.cut}
      </text>

      {/* la cuenta y el código, fila por fila */}
      <BoxTitle G={G} b={acct} title={m.account.title} sub={m.account.sub} seed={SEEDS.acct} />
      <BoxTitle G={G} b={mod} title={m.code.title} sub={m.code.sub} seed={SEEDS.code} />
      {ROWS.map((row, i) => {
        const y = G.row(i);
        const state = rowState(c, row);
        const here = accountRow(c, row);
        const valueCls = failed ? "sb-val dim" : here.value !== m.values[row] ? "sb-val bad" : "sb-val";
        return (
          <g key={row}>
            <path d={`M${acct.x + acct.w} ${y.mid}H${mod.x}`} className="s-guide" />
            {[acct, mod].map((b) => (
              <text key={b.x} x={b.x + PAD} y={y.label} className="s-lab">
                {m.rows[row]}
              </text>
            ))}
            <text x={acct.x + PAD} y={y.value} className={valueCls}>
              {here.value}
            </text>
            <text x={mod.x + PAD} y={y.value} className="sb-val">
              {m.values[row]}
            </text>
            {row !== "instance" && <Chip G={G} x={chipX(acct)} y={y.chip} text={m.drift[row]} on={here.added !== null} />}
            <g className={`sb-mark ${state}`} style={after(phase, T.marks + i * 0.12)}>
              <circle cx={G.markX} cy={y.mid} r={9} />
              <text x={G.markX} y={y.mid + 4} textAnchor="middle">
                {m.marks[state]}
              </text>
            </g>
          </g>
        );
      })}

      {/* el plan de los lunes */}
      <Drawn pts={rectPts(plan.x, plan.y, plan.w, plan.h)} seed={SEEDS.plan} />
      <text x={plan.x + plan.w / 2} y={plan.y + 22} textAnchor="middle" className="sb-val strong">
        {m.plan.title}
      </text>
      <text x={plan.x + plan.w / 2} y={plan.y + 39} textAnchor="middle" className="s-lab">
        {m.plan.sub}
      </text>

      {/* su código de salida, hasta la luz de Gatus */}
      <path d={`M${ex0[0]} ${ex0[1]}L${ex1[0]} ${ex1[1]}`} className="s-link" style={stroke(exitLen, 1, phase, T.exit)} />
      <path d={head} className="sb-head" style={after(phase, T.exit + 0.5)} />
      <text x={G.exit.label[0]} y={G.exit.label[1]} textAnchor={G.exit.anchor} className={`sb-exit ${lit}`} style={after(phase, T.exit + 0.3)}>
        {m.exit}
        {code}
      </text>
      <text x={G.gatus.name[0]} y={G.gatus.name[1]} textAnchor={G.gatus.anchor} className="s-title">
        {m.gatus}
      </text>
      <circle cx={G.light[0]} cy={G.light[1]} r={17} className={phase === "go" ? `sb-halo ${lit}` : "sb-halo"} style={{ transitionDelay: phase === "go" ? `${T.light}s` : "0s" }} />
      <circle cx={G.light[0]} cy={G.light[1]} r={11} className={phase === "go" ? `sb-light ${lit}` : "sb-light"} style={{ transitionDelay: phase === "go" ? `${T.light}s` : "0s" }} />
      <text x={G.gatus.status[0]} y={G.gatus.status[1]} textAnchor={G.gatus.anchor} className={`sb-status ${lit}`} style={after(phase, T.light)}>
        {m.status[lit]}
      </text>

      {/* el plan nunca aplica */}
      {m.note.map((line, i) => (
        <text key={line} x={G.note[0]} y={G.note[1] + i * 16} className="s-lab">
          {line}
        </text>
      ))}
    </svg>
  );
}

/** Figura: la cuenta de AWS contra el código, el plan de solo lectura de los lunes y la luz de Gatus */
export function StandbyPlan({ name, wide, label, caption }: FigureProps) {
  const [c, setC] = useState<PlanCase>("igual");
  // el cuadro inicial ya muestra el resultado; cada cambio vuelve a correr el plan
  const [phase, setPhase] = useState<Phase>("go");
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seg = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function replay(next: PlanCase) {
    setC(next);
    setRun((r) => r + 1);
    clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setPhase("go");
      return;
    }
    setPhase("start");
    timer.current = setTimeout(() => setPhase("go"), 60);
  }

  function pick(next: PlanCase) {
    if (next !== c) replay(next);
  }

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const step = e.key === "ArrowRight" ? 1 : CASES.length - 1;
    const next = CASES[(CASES.indexOf(c) + step) % CASES.length];
    pick(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-case="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.mode} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{m.modeLabel}</span>
        {CASES.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={c === o}
            tabIndex={c === o ? 0 : -1}
            data-case={o}
            onClick={() => pick(o)}
          >
            {m.modes[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas">
        <Scene G={WIDE} c={c} phase={phase} label={label} />
        <Scene G={NARROW} c={c} phase={phase} label={label} />
        <TfOutput
          id={`${c}-${run}`}
          kicker={m.kicker}
          prompt={m.prompt}
          command={m.command}
          lines={m.output[c]}
          delay={run > 0 ? T.exit : 0}
        />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="sim-controls">
          <button type="button" className="plain" onClick={() => replay(c)}>
            {`↺ ${m.again}`}
          </button>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(m.results[c])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

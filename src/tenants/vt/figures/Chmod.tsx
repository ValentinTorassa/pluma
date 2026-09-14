"use client";

import { Fragment, useState } from "react";
import { copy } from "../messages";
import { frame, poly, rectPts, rng, sketch, type Pt } from "./ink";
import { useSvgId } from "./motion";
import { FigureFrame, Glyph, Marks, Paper, type FigureProps } from "./parts";
import { rich } from "./rich";

const m = copy.figures.chmod;

const RWX = ["r", "w", "x"] as const;
const PRESETS = ["600", "640", "644", "777"] as const;
const START = [1, 1, 0, 1, 0, 0, 0, 0, 0]; // 640
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7];
const PERMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const BRACKETS = [1, 4, 7];
const ROLL = 50;

type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  cx: number[];
  cs: number;
  rows: number[];
  hy: number;
  ox: number;
  sx: number;
  sy: number;
  sd: number;
  gy: number;
  cmd: Pt;
  file: Pt | null;
};

const NARROW: Geo = { narrow: true, M: 12, W: 380, H: 356, cx: [148, 196, 244], cs: 36, rows: [78, 128, 178], hy: 36, ox: 322, sx: 70, sy: 262, sd: 24, gy: 286, cmd: [190, 336], file: null };
const WIDE: Geo = { narrow: false, M: 20, W: 720, H: 236, cx: [196, 250, 304], cs: 40, rows: [76, 130, 184], hy: 32, ox: 388, sx: 470, sy: 122, sd: 22, gy: 148, cmd: [470, 200], file: [470, 68] };

const octal = (bits: number[]) => [0, 1, 2].map((i) => bits[i * 3] * 4 + bits[i * 3 + 1] * 2 + bits[i * 3 + 2]);
const fromOctal = (os: string) =>
  os.split("").flatMap((ch) => {
    const d = Number(ch);
    return [(d >> 2) & 1, (d >> 1) & 1, d & 1];
  });

function Scene({ G, bits, toggle, uid, label }: { G: Geo; bits: number[]; toggle: (k: number) => void; uid: string; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const mode = G.narrow ? "n" : "w";
  const o = octal(bits);
  const clipId = (i: number) => `oc-${mode}-${i}-${uid}`;

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="group" aria-label={label}>
      <Paper vb={vb} step={20} />
      {m.verbs.map((verb, j) => (
        <Fragment key={verb}>
          <text x={G.cx[j]} y={G.hy} textAnchor="middle" className="s-lab">
            {verb}
          </text>
          <text x={G.cx[j]} y={G.hy - 17} textAnchor="middle" className="s-tick">
            {String(4 >> j)}
          </text>
        </Fragment>
      ))}
      <text x={G.ox} y={G.hy} textAnchor="middle" className="s-lab">
        {m.octal}
      </text>
      <defs>
        {G.rows.map((y, i) => (
          <clipPath key={y} id={clipId(i)}>
            <rect x={G.ox - 22} y={y - 23} width={44} height={44} />
          </clipPath>
        ))}
      </defs>
      {G.rows.map((y, i) => (
        <Fragment key={y}>
          <text x={0} y={y - 2} className="s-title">
            {m.who[i][0]}
          </text>
          <text x={0} y={y + 15} className="s-lab">
            {m.who[i][1]}
          </text>
          {RWX.map((ch, j) => {
            const k = i * 3 + j;
            const s = G.cs;
            const x = G.cx[j] - s / 2;
            const yy = y - s / 2;
            const on = bits[k] === 1;
            return (
              <g
                key={ch}
                className={`cell${on ? " on" : ""}${on && k >= 7 ? " danger" : ""}`}
                tabIndex={0}
                role="switch"
                aria-checked={on}
                aria-label={`${m.who[i][0]}: ${m.verbs[j]}`}
                onClick={() => toggle(k)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggle(k);
                  }
                }}
              >
                <path d={poly(rectPts(x, yy, s, s))} className="s-cellfill" />
                <path d={sketch(rng(300 + k), rectPts(x, yy, s, s), true, 1.3, 0.7)} className="s-cellink" />
                <text x={G.cx[j]} y={y + 5} textAnchor="middle">
                  {ch}
                </text>
              </g>
            );
          })}
          <path d={sketch(rng(320 + i), rectPts(G.ox - 23, y - 24, 46, 46), true, 1.2, 0.6)} className="s-ink-thin" />
          <g clipPath={`url(#${clipId(i)})`}>
            <g style={{ transform: `translate(0px,${-o[i] * ROLL}px)` }}>
              {DIGITS.map((d) => (
                <text key={d} x={G.ox} y={y + 13 + d * ROLL} textAnchor="middle" className="s-oct">
                  {String(d)}
                </text>
              ))}
            </g>
          </g>
        </Fragment>
      ))}
      {G.file && (
        <>
          <Glyph name="file" x={G.file[0]} y={G.file[1] - 12} s={14} />
          <text x={G.file[0] + 20} y={G.file[1]} className="s-lab s-mono">
            {m.ls}
          </text>
        </>
      )}
      {PERMS.map((p) => {
        const x = G.sx + p * G.sd;
        if (p === 0) {
          return (
            <g key={p}>
              <text x={x} y={G.sy} className="s-perm" style={{ opacity: 1 }}>
                -
              </text>
              <text x={x} y={G.sy} className="s-perm off" style={{ opacity: 0 }}>
                -
              </text>
            </g>
          );
        }
        const b = bits[p - 1] === 1;
        return (
          <g key={p}>
            <text
              x={x}
              y={G.sy}
              className={`s-perm${p >= 8 && b ? " danger" : ""}`}
              style={{ opacity: b ? 1 : 0, transform: b ? "translate(0px,0px)" : "translate(0px,-6px)" }}
            >
              {RWX[(p - 1) % 3]}
            </text>
            <text
              x={x}
              y={G.sy}
              className="s-perm off"
              style={{ opacity: b ? 0 : 1, transform: b ? "translate(0px,6px)" : "translate(0px,0px)" }}
            >
              -
            </text>
          </g>
        );
      })}
      {BRACKETS.map((p, i) => {
        const a = G.sx + p * G.sd - 1;
        const b = G.sx + (p + 2) * G.sd + 15;
        const yb = G.sy + 8;
        return (
          <Fragment key={p}>
            <path d={`M${a} ${yb}v4H${b}v-4`} className="s-bracket" />
            <text x={(a + b) / 2} y={G.gy + 4} textAnchor="middle" className="s-tick">
              {m.who[i][0]}
            </text>
          </Fragment>
        );
      })}
      <text x={G.cmd[0]} y={G.cmd[1]} textAnchor={G.file ? "start" : "middle"} className="s-cmd">
        {m.cmd(o.join(""))}
      </text>
    </svg>
  );
}

function result(bits: number[]): string {
  if (bits[7] || bits[8]) return m.results.othersWrite;
  if (bits[6]) return m.results.othersRead;
  if (bits[3] || bits[4] || bits[5]) return m.results.group;
  if (bits[0] || bits[1]) return m.results.owner;
  return m.results.nobody;
}

/** Figura D: permisos de config.env; celdas clickeables, presets y rodillos octales */
export function Chmod({ name, wide, label, caption }: FigureProps) {
  const uid = useSvgId();
  const [bits, setBits] = useState(START);
  const os = octal(bits).join("");
  const toggle = (k: number) => setBits((prev) => prev.map((v, i) => (i === k ? v ^ 1 : v)));

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <Scene G={WIDE} bits={bits} toggle={toggle} uid={uid} label={label} />
        <Scene G={NARROW} bits={bits} toggle={toggle} uid={uid} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="presets" role="group" aria-label={m.presetsLabel}>
          <span className="muted">{m.try}</span>
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={os === p} onClick={() => setBits(fromOctal(p))}>
              {p}
            </button>
          ))}
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(bits))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

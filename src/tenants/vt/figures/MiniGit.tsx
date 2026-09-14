"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";
import { frame, sheetPts } from "./ink";
import { prefersReducedMotion } from "./motion";
import { Drawn, Marks, Node, Paper, SelBox } from "./parts";

const m = copy.figures.miniGit;

/** final: HEAD en el último commit, sin .env · start: .env todavía está y HEAD en el anterior · moved: HEAD ya llegó */
type Phase = "final" | "start" | "moved";

function Scene({ narrow, phase, label }: { narrow: boolean; phase: Phase; label: string }) {
  const W = narrow ? 360 : 680;
  const cw = narrow ? 112 : 196;
  const gap = narrow ? 12 : 46;
  const H = narrow ? 148 : 140;
  const M = narrow ? 10 : 16;
  const ny = 14;
  const sy = 32;
  const sh = 78;
  const { viewBox, vb } = frame(W, H, M);
  const xs = m.commits.map((_, i) => i * (cw + gap));
  const envOn = phase !== "final";
  const headX = phase === "start" ? xs[1] : xs[2];

  return (
    <svg
      className={`ink ${narrow ? "mini-n" : "mini-w"}${phase === "start" ? " still" : ""}`}
      viewBox={viewBox}
      role="img"
      aria-label={label}
    >
      <Paper vb={vb} step={20} />
      <path d={`M${cw / 2} ${ny}H${W - cw / 2}`} className="s-chain" />
      {m.commits.map((hash, i) => {
        const x = xs[i];
        const last = i === m.commits.length - 1;
        return (
          <g key={hash}>
            <Drawn pts={sheetPts(x, sy, cw, sh, 12)} seed={60 + i} fold={12} />
            <Node cx={x + cw / 2} cy={ny} r={5} />
            <text x={x + 10} y={sy + 20} className="s-hash">
              {hash}
            </text>
            <text x={x + 12} y={sy + 44} className="s-file">
              {m.file}
            </text>
            <g
              className="is-key"
              style={
                last
                  ? { opacity: envOn ? 1 : 0, transform: envOn ? "translate(0px,0px)" : "translate(8px,0px)" }
                  : undefined
              }
            >
              <rect x={x + 6} y={sy + 52} width={cw - 12} height={19} rx={3} className="s-keybg" />
              <text x={x + 12} y={sy + 65.5} className="s-file">
                {m.env}
              </text>
            </g>
          </g>
        );
      })}
      <g style={{ transform: `translate(${headX}px,0px)` }}>
        <SelBox x={-7} y={sy - 7} w={cw + 14} h={sh + 14} />
        <text x={cw - (narrow ? 8 : 20)} y={narrow ? sy + 44 : sy + 20} textAnchor="end" className="s-headtxt">
          {m.head}
        </text>
      </g>
      <text x={0} y={H - 4} className="s-lab">
        {narrow ? m.noteNarrow : m.noteWide}
      </text>
    </svg>
  );
}

/**
 * Figura chica del home: tres commits y HEAD. Se dibuja ya en el estado final
 * (sirve sin JS); al cargar y al pasar el mouse por el link repite el borrado.
 */
export function MiniGit({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>("final");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const play = () => {
      if (prefersReducedMotion()) return;
      clear();
      setPhase("start");
      timers.push(
        setTimeout(() => {
          setPhase("moved");
          timers.push(setTimeout(() => setPhase("final"), 650));
        }, 500),
      );
    };
    timers.push(setTimeout(play, 350));
    const link = root.current?.closest("a");
    link?.addEventListener("mouseenter", play);
    return () => {
      clear();
      link?.removeEventListener("mouseenter", play);
    };
  }, []);

  return (
    <div ref={root} className="fig-canvas fig-mini" data-figure="git-history">
      <Scene narrow={false} phase={phase} label={label} />
      <Scene narrow phase={phase} label={label} />
      <Marks />
    </div>
  );
}

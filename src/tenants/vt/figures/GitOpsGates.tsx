"use client";

import { useState } from "react";
import { copy } from "../messages";
import { FigureFrame, Marks, type FigureProps } from "./parts";

const m = copy.figures.gitopsGates;

/** Tablero de estaciones: cada dato sale de la corrida local del laboratorio. */
export function GitOpsGates({ name, wide, caption }: FigureProps) {
  const [active, setActive] = useState(1);
  const station = m.stations[active];

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <div className="gt-panel gt-gates">
          <header className="gt-panel-head">
            <div><span className="gt-eyebrow">{m.kicker}</span><h3>{m.title}</h3></div>
            <span className="gt-panel-index">{String(active + 1).padStart(2, "0")} / {String(m.stations.length).padStart(2, "0")}</span>
          </header>
          <div className="gt-stations" role="group" aria-label={m.choose}>
            {m.stations.map((item, index) => (
              <button key={item.name} className="gt-station" data-state={item.state} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
                <span className="gt-station-light" aria-hidden="true" />
                <span className="gt-station-number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.name}</strong>
                <small>{item.status}</small>
              </button>
            ))}
          </div>
          <div className="gt-gate-detail" aria-live="polite" aria-atomic="true">
            <div className="gt-gate-explain">
              <span className="gt-eyebrow">{station.kicker}</span>
              <strong>{station.heading}</strong>
              <p>{station.explain}</p>
            </div>
            <div className="gt-terminal">
              <div className="gt-terminal-bar">{m.terminal}</div>
              <code>{station.command}</code>
              <pre>{station.output}</pre>
            </div>
          </div>
        </div>
        <Marks />
      </div>
      {caption && <div className="fig-foot"><figcaption>{caption}</figcaption></div>}
    </FigureFrame>
  );
}

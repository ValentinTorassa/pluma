"use client";

import { useState } from "react";
import { copy } from "../messages";
import { FigureFrame, Marks, type FigureProps } from "./parts";

const m = copy.figures.roleProof;

export function RoleProof({ name, wide, caption }: FigureProps) {
  const [active, setActive] = useState(0);
  const role = m.roles[active];

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas rp-canvas">
        <div className="rp-top">
          <div>
            <p className="rp-kicker">{m.kicker}</p>
            <p className="rp-title">{m.title}</p>
          </div>
          <div className="rp-tabs" aria-label={m.selectLabel}>
            {m.roles.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div className="rp-path" aria-live="polite">
          <div className="rp-node">
            <span>01 / {m.task}</span>
            <strong>{role.task}</strong>
          </div>
          <span className="rp-arrow" aria-hidden="true">→</span>
          <div className="rp-node">
            <span>02 / {m.evidence}</span>
            <strong>{role.evidence}</strong>
          </div>
          <span className="rp-arrow" aria-hidden="true">→</span>
          <div className="rp-node rp-node-limit">
            <span>03 / {m.limit}</span>
            <strong>{role.limit}</strong>
          </div>
        </div>
        <Marks />
      </div>
      {caption && <div className="fig-foot"><figcaption>{caption}</figcaption></div>}
    </FigureFrame>
  );
}

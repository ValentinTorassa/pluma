"use client";

import { useState } from "react";
import { copy } from "../messages";
import { FigureFrame, Marks, type FigureProps } from "./parts";

const m = copy.figures.gitopsDrift;

function ReplicaMeter({ count, changed }: { count: number; changed?: boolean }) {
  return (
    <div className="gt-replica-meter" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < count ? "on" : ""} data-extra={changed && index >= 2 ? "true" : undefined} />
      ))}
    </div>
  );
}

/** El desvío del lab necesita un sync explícito; un revert cambia el propio Git. */
export function GitOpsDrift({ name, wide, caption }: FigureProps) {
  const [active, setActive] = useState(1);
  const step = m.steps[active];
  const changed = step.clusterReplicas !== 2;

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <div className="gt-panel gt-drift" data-state={step.state}>
          <header className="gt-panel-head">
            <div><span className="gt-eyebrow">{m.kicker}</span><h3>{m.title}</h3></div>
            <span className="gt-panel-index">{String(active + 1).padStart(2, "0")} / {String(m.steps.length).padStart(2, "0")}</span>
          </header>
          <div className="gt-drift-steps" role="group" aria-label={m.choose}>
            {m.steps.map((item, index) => (
              <button key={item.name} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong>
              </button>
            ))}
          </div>
          <div className="gt-drift-visual" aria-live="polite" aria-atomic="true">
            <section className="gt-state-card gt-state-git">
              <span className="gt-state-label"><i aria-hidden="true" />{m.desired}</span>
              <div className="gt-state-count"><strong>02</strong><span>{m.replicas}</span></div>
              <ReplicaMeter count={2} />
              <div className="gt-state-image"><span>{m.image}</span><code>{m.pinnedImage}</code></div>
            </section>
            <div className="gt-drift-bridge" aria-hidden="true"><span /><b>{changed ? "≠" : "="}</b><span /></div>
            <section className="gt-state-card gt-state-cluster">
              <span className="gt-state-label"><i aria-hidden="true" />{m.actual}</span>
              <div className="gt-state-count"><strong>{String(step.clusterReplicas).padStart(2, "0")}</strong><span>{m.replicas}</span></div>
              <ReplicaMeter count={step.clusterReplicas} changed={changed} />
              <div className="gt-state-image"><span>{m.image}</span><code>{step.clusterImage}</code></div>
            </section>
          </div>
          <div className="gt-drift-result" aria-live="polite" aria-atomic="true">
            <div className="gt-drift-verdict"><span>{step.status}</span><p>{step.explain}</p></div>
            <div className="gt-terminal"><div className="gt-terminal-bar">{m.terminal}</div><code>{step.command}</code><pre>{step.output}</pre></div>
          </div>
          <div className="gt-rollback">
            <div><span className="gt-eyebrow">{m.rollbackKicker}</span><strong>{m.rollbackTitle}</strong><p>{m.rollbackDetail}</p></div>
            <ol>{m.rollback.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></li>)}</ol>
          </div>
          <p className="gt-drift-note">{m.note}</p>
        </div>
        <Marks />
      </div>
      {caption && <div className="fig-foot"><figcaption>{caption}</figcaption></div>}
    </FigureFrame>
  );
}

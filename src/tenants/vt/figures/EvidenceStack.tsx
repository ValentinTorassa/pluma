"use client";

import { useState } from "react";
import { Icon } from "../components/Icon";
import { copy } from "../messages";
import { FigureFrame, Marks, type FigureProps } from "./parts";

const m = copy.figures.evidenceStack;
type Card = (typeof m.cards)[number];
const CARD_ICONS = ["term", "git", "readme"] as const;

function CardFace({ card, index, active, onSelect }: { card: Card; index: number; active: boolean; onSelect?: () => void }) {
  const content = (
    <>
      <div className="ev-card-top">
        <span>{card.number} / {card.type}</span>
        <span className="ev-card-top-mark">✳</span>
      </div>
      <div className="ev-card-heading">
        <span className="ev-card-icon"><Icon name={CARD_ICONS[index]} className="ev-card-glyph" /></span>
        <strong>{card.filename}</strong>
      </div>
      <div className="ev-card-preview">
        <span>{card.previewLabel}</span>
        <b>{card.previewMain}</b>
        <span>{card.previewSub}</span>
      </div>
      <div className="ev-card-bottom">
        <span><i />{card.stamp}</span>
        <span>↗</span>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button className="ev-card" data-index={index} data-active={active} type="button" aria-label={`${m.openCard} ${card.tab}`} aria-pressed={active} onClick={onSelect}>
        {content}
      </button>
    );
  }

  return (
    <div className="ev-card" data-index={index} data-active={active} aria-hidden="true">
      {content}
    </div>
  );
}

function Scene({ active, mini, label, onSelect }: { active: number; mini: boolean; label: string; onSelect?: (index: number) => void }) {
  return (
    <div className={mini ? "ev-scene ev-scene-mini" : "ev-scene"} role={mini ? "img" : "group"} aria-label={label}>
      <div className="ev-floor" aria-hidden="true" />
      <div className="ev-scene-note" aria-hidden="true">{m.sceneNote}</div>
      {m.cards.map((card, index) => (
        <div
          className="ev-card-position"
          data-position={mini ? (["left", "center", "right"] as const)[index] : index === active ? "center" : (index + 1) % m.cards.length === active ? "left" : "right"}
          key={card.filename}
        >
          <CardFace card={card} index={index} active={!mini && active === index} onSelect={onSelect && !mini ? () => onSelect(index) : undefined} />
        </div>
      ))}
    </div>
  );
}

export function EvidenceStack({ name, wide, label, caption }: FigureProps) {
  const [active, setActive] = useState(0);
  const card = m.cards[active];

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas ev-canvas">
        <div className="ev-layout">
          <Scene active={active} mini={false} label={label} onSelect={setActive} />
          <div className="ev-panel">
            <p className="ev-kicker">{m.kicker}</p>
            <div className="ev-tabs" role="group" aria-label={m.selectLabel}>
              {m.cards.map((item, index) => (
                <button
                  key={item.filename}
                  type="button"
                  aria-pressed={active === index}
                  onClick={() => setActive(index)}
                >
                  <span>{item.number}</span> {item.tab}
                </button>
              ))}
            </div>
            <div className="ev-detail" aria-live="polite" aria-atomic="true">
              <p className="ev-detail-number">{card.number} / {card.type}</p>
              <h3>{card.heading}</h3>
              <p>{card.proof}</p>
              <p className="ev-limit"><b>{m.limit}</b> {card.limit}</p>
            </div>
          </div>
        </div>
        <Marks />
      </div>
      {caption && <div className="fig-foot"><figcaption>{caption}</figcaption></div>}
    </FigureFrame>
  );
}

export function MiniEvidenceStack({ label }: { label: string }) {
  return (
    <div className="fig-canvas fig-mini ev-mini" data-figure="evidence-stack">
      <Scene active={0} mini label={label} />
      <div className="ev-mini-labels" aria-hidden="true">
        {m.cards.map((card) => <span key={card.filename}>{card.tab}</span>)}
      </div>
      <Marks />
    </div>
  );
}

"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { copy } from "../messages";

const m = copy.figures.stepper;

/** Flechas + puntos + texto del paso. ← y → funcionan con el foco en cualquier control. */
export function Stepper({
  count,
  index,
  label,
  onChange,
}: {
  count: number;
  index: number;
  label: ReactNode;
  onChange: (i: number) => void;
}) {
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  function go(k: number) {
    const i = Math.max(0, Math.min(count - 1, k));
    // Una flecha deshabilitada pierde el foco: se lo pasa a la otra
    if (i === 0 && document.activeElement === prev.current) next.current?.focus();
    if (i === count - 1 && document.activeElement === next.current) prev.current?.focus();
    onChange(i);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      go(index + 1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      go(index - 1);
      e.preventDefault();
    }
  }

  return (
    <div className="stepper" onKeyDown={onKeyDown}>
      <button
        ref={prev}
        type="button"
        className="st-arrow st-prev"
        aria-label={m.prev}
        disabled={index === 0}
        onClick={() => go(index - 1)}
      >
        ←
      </button>
      <span className="st-dots">
        {Array.from({ length: count }, (_, k) => (
          <button
            key={k}
            type="button"
            className="st-dot"
            aria-label={`${m.step}${k + 1}`}
            aria-current={k === index ? "step" : "false"}
            onClick={() => go(k)}
          />
        ))}
      </span>
      <button
        ref={next}
        type="button"
        className="st-arrow st-next"
        aria-label={m.next}
        disabled={index === count - 1}
        onClick={() => go(index + 1)}
      >
        →
      </button>
      <p className="st-label" aria-live="polite">
        <span className="n tnum">{`${index + 1} ${m.of} ${count}`}</span>
        {label}
      </p>
    </div>
  );
}

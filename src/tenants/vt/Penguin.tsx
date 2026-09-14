import { PENGUINS } from "./assets/penguins";

export type PenguinVariant = 1 | 2 | 3;

/**
 * Pingüino de VT Security, inline y en currentColor (sigue al tema).
 * 1: tres cuartos a la derecha · 2: de frente (el avatar) · 3: tres cuartos a la izquierda.
 * Sin `title` es decorativo (aria-hidden).
 */
export function Penguin({
  variant = 2,
  className,
  title,
}: {
  variant?: PenguinVariant;
  className?: string;
  title?: string;
}) {
  const p = PENGUINS[variant];
  return (
    <svg
      viewBox={p.viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={p.transform} fill="currentColor" stroke="none">
        <path d={p.d} />
      </g>
    </svg>
  );
}

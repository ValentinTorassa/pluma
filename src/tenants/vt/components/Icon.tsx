import { ICONS, type IconName, type IconPart } from "./icons";

/** Ícono dibujado a mano (maqueta v3.1). Decorativo: el texto de al lado ya dice qué es. */
export function Icon({ name, className = "ico" }: { name: IconName; className?: string }) {
  const icon = ICONS[name];
  const parts: readonly IconPart[] = icon.parts;
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform={`rotate(${icon.rotate} 32 32)`}>
        {parts.map((p, i) =>
          p.ground ? (
            <path key={i} d={p.d} className="ico-ground" />
          ) : (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={p.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dash}
              opacity={p.opacity}
            />
          ),
        )}
      </g>
    </svg>
  );
}

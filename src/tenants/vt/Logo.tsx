import type { LogoProps } from "../types";

/** TODO(phase4): logo definitivo. Placeholder tipográfico en mono. */
export function Logo({ className = "" }: LogoProps) {
  return (
    <span aria-hidden className={`font-mono font-semibold tracking-tight text-accent ${className}`}>
      VT/SEC
    </span>
  );
}

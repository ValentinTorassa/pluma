import { useEffect, useId, useRef, useState } from "react";

/** Con reduced motion los cambios de estado son instantáneos (la CSS ya corta las transiciones) */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** useId apto para ids de SVG referenciados con url(#…) */
export function useSvgId(): string {
  return useId().replace(/[^A-Za-z0-9_-]/g, "");
}

/** Número que llega a `target` en 700ms (ease in-out cúbico), como los contadores de la maqueta */
export function useTweenNumber(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (start === target) return;
    let raf = 0;
    if (prefersReducedMotion()) {
      raf = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      setShown(Math.round(start + (target - start) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}

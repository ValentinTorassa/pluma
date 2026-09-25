/**
 * Piezas compartidas de las figuras que simulan pedidos en vivo (estilo
 * samwho.dev): un reloj que avanza solo mientras la figura se reproduce y está
 * en pantalla, y el calendario de pedidos de cada cliente.
 *
 * La simulación de cada figura es una función pura del tiempo: el servidor y
 * el navegador dibujan el mismo cuadro, y el cuadro inicial se entiende sin
 * tocar nada.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Pt } from "./ink";
import { prefersReducedMotion } from "./motion";

/** Un cliente manda un pedido cada `period` segundos, empezando en `offset` */
export type Schedule = { readonly period: number; readonly offset: number };

/** Unidades del viewBox por segundo: la velocidad de todos los puntos */
export const SPEED = 150;

/** Cuánto dura la × de un pedido rechazado o cortado */
export const FLASH = 0.6;

/** Todos los pedidos mandados hasta `t` (para contar lo que ya pasó) */
export function sent(t: number, { period, offset }: Schedule): number[] {
  const out: number[] = [];
  for (let s = offset; s <= t; s += period) out.push(s);
  return out;
}

/** Los pedidos que pueden seguir vivos en `t`, si cada uno dura `life` segundos */
export function inFlight(t: number, { period, offset }: Schedule, life: number): number[] {
  const out: number[] = [];
  const last = Math.floor((t - offset) / period);
  for (let k = Math.max(0, Math.floor((t - offset - life) / period)); k <= last; k++) out.push(offset + k * period);
  return out;
}

export const lerp = (a: Pt, b: Pt, p: number): Pt => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];

/** Lo que se mueve cuadro a cuadro no pasa por las transiciones CSS */
export const STILL: CSSProperties = { transition: "none" };

/**
 * Reloj de la simulación. Arranca quieto en `start` (el cuadro inicial) y
 * avanza con requestAnimationFrame mientras se reproduce, solo si la figura
 * está en pantalla. Con reduced motion salta de a un segundo y la figura no
 * dibuja puntos en vuelo: cambian solo los conteos.
 */
export function usePlayClock(start: number) {
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  /** El tiempo actual para los handlers (el estado `t` llega un render tarde) */
  const clock = useRef(start);
  const visible = useRef(true);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      const id = setInterval(() => {
        if (!visible.current) return;
        clock.current += 1;
        setT(clock.current);
      }, 1000);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      if (last >= 0 && visible.current) {
        clock.current += Math.min(0.1, (now - last) / 1000);
        setT(clock.current);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  function play() {
    setReduced(prefersReducedMotion());
    setPlaying(true);
  }

  function toggle() {
    if (playing) setPlaying(false);
    else play();
  }

  function reset(to: number) {
    clock.current = to;
    setT(to);
  }

  return { t, playing, reduced, clock, canvas, play, toggle, reset };
}

"use client";

import { useSyncExternalStore } from "react";

const SIZES = ["1rem", "1.125rem", "1.35rem"];
let current = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return 1;
}

function setFont(next: number) {
  current = next;
  document.documentElement.style.setProperty("--article-size", SIZES[next]);
  try {
    localStorage.setItem("pluma:font", String(next));
  } catch {
    /* ignore */
  }
  emit();
}

if (typeof window !== "undefined") {
  const stored = Number(localStorage.getItem("pluma:font"));
  if (stored === 0 || stored === 1 || stored === 2) {
    current = stored;
    document.documentElement.style.setProperty("--article-size", SIZES[stored]);
  }
}

export function ArticleToolbar() {
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const btn =
    "rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-40";

  return (
    <div className="no-print mt-6 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={btn}
        disabled={size === 0}
        onClick={() => setFont(Math.max(0, size - 1))}
        aria-label="Letra más chica"
      >
        A−
      </button>
      <button
        type="button"
        className={btn}
        disabled={size === 2}
        onClick={() => setFont(Math.min(2, size + 1))}
        aria-label="Letra más grande"
      >
        A+
      </button>
      <button type="button" className={btn} onClick={() => window.print()}>
        Imprimir
      </button>
    </div>
  );
}

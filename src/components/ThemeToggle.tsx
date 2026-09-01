"use client";

import { useSyncExternalStore } from "react";

let dark = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(next: boolean) {
  dark = next;
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("pluma:theme", next ? "dark" : "light");
  } catch {
    /* ignore */
  }
  emit();
}

if (typeof window !== "undefined") {
  dark = localStorage.getItem("pluma:theme") === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, () => dark, () => false);

  return (
    <button
      type="button"
      aria-label={isDark ? "Modo claro" : "Modo noche"}
      onClick={() => apply(!isDark)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-ink"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />
        </svg>
      )}
    </button>
  );
}

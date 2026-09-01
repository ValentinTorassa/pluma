"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SIZES = ["1rem", "1.2rem", "1.5rem"];
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

function applyFont(next: number) {
  current = next;
  document.documentElement.style.setProperty("--article-size", SIZES[next]);
  document.documentElement.dataset.font = String(next);
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
    document.documentElement.dataset.font = String(stored);
  }
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9V3h12v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinejoin="round" />
      <path d="M6 14h12v7H6z" strokeLinejoin="round" />
    </svg>
  );
}

export function ReaderMenu() {
  const pathname = usePathname();
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!pathname.startsWith("/articulo/")) return null;

  const item =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-accent-soft disabled:opacity-40";

  return (
    <div className="relative no-print" ref={root}>
      <button
        type="button"
        aria-label="Más opciones"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-ink"
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
          <button
            type="button"
            className={item}
            disabled={size === 0}
            onClick={() => applyFont(Math.max(0, size - 1))}
          >
            <MinusIcon />
            Letra más chica
          </button>
          <button
            type="button"
            className={item}
            disabled={size === 2}
            onClick={() => applyFont(Math.min(2, size + 1))}
          >
            <PlusIcon />
            Letra más grande
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            <PrintIcon />
            Imprimir
          </button>
        </div>
      )}
    </div>
  );
}

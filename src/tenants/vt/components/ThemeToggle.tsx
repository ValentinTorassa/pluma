"use client";

import { useSyncExternalStore } from "react";
import { config } from "../config";
import { copy } from "../messages";

const KEY = `${config.storagePrefix}:theme`;
const listeners = new Set<() => void>();

function isDark(): boolean {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen) return chosen === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
  };
}

function toggle() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* sin localStorage: vale para esta visita */
  }
  listeners.forEach((l) => l());
}

/** Botón de texto: dice a qué tema pasa ("Oscuro" / "Claro"). */
export function ThemeToggle() {
  // En el servidor no se sabe el tema: se hidrata con "Oscuro" y se corrige
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  return (
    <button type="button" className="linkbtn" onClick={toggle} aria-label={copy.theme.toggle}>
      {dark ? copy.theme.toLight : copy.theme.toDark}
    </button>
  );
}

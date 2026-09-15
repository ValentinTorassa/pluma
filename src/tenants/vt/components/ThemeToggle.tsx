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

/**
 * Sol y luna a mano, en la misma tinta que el resto del sitio. No salen de
 * icons.ts porque eso lo genera un script desde la maqueta: esto es un control
 * de la interfaz, no un ícono de artículo.
 */
function Sun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 7.4Q15 7.3 16.7 9.9Q18.3 12.6 16.6 15.1Q14.9 17.6 12 17.5Q9 17.4 7.4 14.8Q5.9 12.2 7.5 9.7Q9.1 7.3 12 7.4Z" strokeWidth="1.7" />
        <path d="M12 2.6V4.4M12 19.6V21.4M2.6 12H4.4M19.6 12H21.4M5.5 5.3L6.8 6.7M17.3 17.2L18.6 18.5M18.5 5.4L17.1 6.8M6.7 17.3L5.4 18.6" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M16.4 3.9Q9.6 4.6 6.6 9.6Q3.7 14.6 7.4 18.4Q11.1 22.1 16.1 19.6Q11.2 19.2 9.5 15Q7.8 10.8 11 6.9Q12.9 4.7 16.4 3.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Control de tema: botón con borde, fuera del <nav>, para que se lea como una
 * opción del sitio y no como una sección más.
 */
export function ThemeToggle() {
  // En el servidor no se sabe el tema: se hidrata en claro y se corrige
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const label = dark ? copy.theme.toLight : copy.theme.toDark;

  return (
    <button type="button" className="themebtn" onClick={toggle} aria-label={`${copy.theme.toggle}: ${label}`} title={label}>
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

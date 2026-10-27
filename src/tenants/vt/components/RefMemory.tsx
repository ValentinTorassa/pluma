"use client";

import { useEffect } from "react";
import { rememberRef } from "../lib/session-ref";

/**
 * Anota el `?ref=` de la página por la que se entró (ver lib/session-ref.ts),
 * para que NewsletterFields lo mande aunque el alta sea en otra página. Va en
 * el footer porque es lo único del tenant que se pinta en todas: así también
 * cuenta un link a un número de Apuntes o a una serie, que no tienen
 * formulario. El footer es del layout, así que corre una vez por carga.
 */
export function RefMemory() {
  useEffect(() => {
    rememberRef(window.location.search);
  }, []);

  return null;
}

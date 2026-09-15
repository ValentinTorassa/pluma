"use client";

import { useEffect } from "react";

/**
 * Suma una visita cuando el artículo ya se pintó (feature `views`). Va del lado
 * del cliente a propósito: así los prefetch de Next y la mayoría de los bots,
 * que no ejecutan JS, no cuentan. Falla en silencio: es una métrica, no el sitio.
 */
export function ViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ articleId });
    const timer = setTimeout(() => {
      fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
        () => {},
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [articleId]);

  return null;
}

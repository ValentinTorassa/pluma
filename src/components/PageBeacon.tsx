"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageKey } from "@/lib/page-key";

/**
 * Suma una visita a las páginas que no son un artículo: home, /apuntes,
 * /acerca, /series, /archivo y /buscar (feature `views`).
 *
 * Mismo criterio que ViewBeacon: del lado del cliente y después de pintar, así
 * los prefetch de Next y los bots que no ejecutan JS no cuentan, y falla en
 * silencio porque es una métrica, no el sitio. Los artículos los sigue
 * contando ViewBeacon con su `articleId`.
 */
export function PageBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pageKey(pathname)) return;
    const body = JSON.stringify({ page: pathname });
    const timer = setTimeout(() => {
      fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
        () => {},
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}

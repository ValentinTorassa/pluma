"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/content/plugins";
import { copy } from "../messages";

/** id del último h2 que cruzó el 30% superior de la ventana */
function useActiveHeading(key: string) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const id of key.split("|")) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [key]);

  return active;
}

/**
 * Índice del artículo: `side` es la columna fija (≥1220px) y `inline` el
 * desplegable que se ve en pantallas más chicas (lo alterna el CSS).
 */
export function Toc({ headings, variant }: { headings: Heading[]; variant: "side" | "inline" }) {
  const active = useActiveHeading(headings.map((h) => h.id).join("|"));

  const list = (
    <ol>
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className={active === h.id ? "is-active" : undefined}
            aria-current={active === h.id ? "location" : undefined}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "side") {
    return (
      <nav className="toc toc-side" aria-label={copy.article.toc}>
        <p className="toc-title">{copy.article.toc}</p>
        {list}
      </nav>
    );
  }

  return (
    <details className="toc toc-inline">
      <summary>{copy.article.toc}</summary>
      {list}
    </details>
  );
}

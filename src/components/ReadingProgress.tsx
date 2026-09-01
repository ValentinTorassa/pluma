"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function ReadingProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (h.scrollTop / max) * 100)) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  if (!pathname.startsWith("/articulo/")) return null;

  return (
    <div
      aria-hidden
      className="no-print fixed inset-x-0 top-0 z-30 h-0.5 bg-line/30"
    >
      <div
        className="h-full bg-accent transition-[width] duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

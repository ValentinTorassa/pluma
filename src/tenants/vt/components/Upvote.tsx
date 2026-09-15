"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { config } from "../config";
import { messages } from "../messages";

const m = messages.upvote;

/**
 * Voto anónimo del artículo. La API, la tabla y el rate limit (1 por hash de IP)
 * son los compartidos; acá cambia solo la forma: un botón de texto en tinta, no
 * la píldora del tenant yanina.
 */
export function Upvote({ articleId, initialCount }: { articleId: string; initialCount: number }) {
  const storageKey = `${config.storagePrefix}:upvote:${articleId}`;
  const [voted, setVoted] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(storageKey) === "1" : false,
  );
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      const res = await fetch("/api/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { voted: boolean; count: number };
      setVoted(data.voted);
      setCount(data.count);
      try {
        localStorage.setItem(storageKey, data.voted ? "1" : "0");
      } catch {
        /* sin localStorage: vale para esta visita */
      }
      router.refresh();
    });
  }

  return (
    <div className="upv">
      <button type="button" className="upvbtn" onClick={toggle} disabled={pending} aria-pressed={voted}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M8 2.6 L13.6 12.4 Q13.8 13.4 12.7 13.3 L3.3 13.3 Q2.2 13.4 2.4 12.4 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="tnum">{count}</span>
        <span>{voted ? m.voted : m.notVoted}</span>
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function UpvoteButton({
  articleId,
  initialCount,
}: {
  articleId: string;
  initialCount: number;
}) {
  const storageKey = `pluma:upvote:${articleId}`;
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
      localStorage.setItem(storageKey, data.voted ? "1" : "0");
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={voted}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        voted
          ? "border-accent bg-accent text-white"
          : "border-line bg-white text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <span aria-hidden>▲</span>
      {count} {voted ? "· ¡Gracias!" : "· Me sirvió"}
    </button>
  );
}

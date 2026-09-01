"use client";

import { useState, useTransition } from "react";

export function CommentForm({
  articleId,
  parentId,
  compact,
}: {
  articleId: string;
  parentId?: string;
  compact?: boolean;
}) {
  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, parentId, username, content }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setMessage({ ok: data.ok, text: data.message });
      if (data.ok) {
        setUsername("");
        setContent("");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "rounded-xl border border-line bg-white p-4"
          : "rounded-xl border border-line bg-white p-5"
      }
    >
      {!compact && (
        <>
          <h3 className="font-serif text-lg font-semibold">Dejá tu comentario</h3>
          <p className="mt-1 text-xs text-muted">
            Los comentarios se publican una vez aprobados por la autora.
          </p>
        </>
      )}
      <div className="mt-3 space-y-3">
        <input
          type="text"
          required
          minLength={2}
          maxLength={40}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tu nombre o seudónimo"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          required
          minLength={3}
          maxLength={2000}
          rows={compact ? 3 : 4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escribí tu comentario…"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className={
            compact
              ? "rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
              : "rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
          }
        >
          {pending ? "Enviando…" : "Responder"}
        </button>
        {message && (
          <p className={`text-xs ${message.ok ? "text-green-700" : "text-red-700"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

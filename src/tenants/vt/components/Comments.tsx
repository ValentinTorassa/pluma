"use client";

import { useState, useTransition } from "react";
import type { Comment } from "@/db/schema";
import { relativeTime } from "@/lib/format";
import { messages } from "../messages";

const m = messages.comments;

function CommentForm({
  articleId,
  parentId,
  onDone,
}: {
  articleId: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const idBase = parentId ? `c-${parentId}` : "c";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/comentarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, parentId, username, content }),
        });
        const data = (await res.json()) as { ok: boolean; message: string };
        setResult({ ok: data.ok, text: data.message });
        if (data.ok) {
          setUsername("");
          setContent("");
          onDone?.();
        }
      } catch {
        setResult({ ok: false, text: messages.api.commentsUnavailable });
      }
    });
  }

  return (
    <form className={parentId ? "cform cform-reply" : "cform"} onSubmit={submit}>
      <label htmlFor={`${idBase}-name`}>
        {m.namePlaceholder}
        <input
          className="input"
          id={`${idBase}-name`}
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={40}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label htmlFor={`${idBase}-body`}>
        {m.contentPlaceholder}
        <textarea
          className="input"
          id={`${idBase}-body`}
          required
          minLength={3}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <div className="row">
        {result ? (
          <p className={result.ok ? "ok" : "err"} role="status">
            {result.text}
          </p>
        ) : (
          <span />
        )}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? m.sending : m.submit}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  all,
  articleId,
  nested,
}: {
  comment: Comment;
  all: Comment[];
  articleId: string;
  nested: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const replies = all.filter((c) => c.parentId === comment.id);

  return (
    <div className={nested ? "reply" : "comment"}>
      <header>
        <b>{comment.username}</b>
        <span suppressHydrationWarning>{relativeTime(comment.createdAt)}</span>
      </header>
      <p>{comment.content}</p>
      <button type="button" className="plain" onClick={() => setReplying((v) => !v)}>
        {replying ? m.cancel : m.reply}
      </button>
      {replying && (
        <CommentForm articleId={articleId} parentId={comment.id} />
      )}
      {replies.map((r) => (
        <CommentItem key={r.id} comment={r} all={all} articleId={articleId} nested />
      ))}
    </div>
  );
}

/** Comentarios moderados (solo llegan los aprobados) y formulario */
export function Comments({ articleId, comments }: { articleId: string; comments: Comment[] }) {
  const top = comments.filter((c) => !c.parentId);

  return (
    <section className="comments" aria-labelledby="cm-h">
      <h2 className="t-h2" id="cm-h">
        {m.title}
      </h2>
      <p className="comments-note">{m.moderationNote}</p>
      {top.map((c) => (
        <CommentItem key={c.id} comment={c} all={comments} articleId={articleId} nested={false} />
      ))}
      <CommentForm articleId={articleId} />
    </section>
  );
}

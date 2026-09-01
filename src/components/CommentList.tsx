"use client";

import { useState } from "react";
import type { Comment } from "@/db/schema";
import { CommentForm } from "./CommentForm";

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function CommentItem({
  comment,
  all,
  articleId,
  isReply,
}: {
  comment: Comment;
  all: Comment[];
  articleId: string;
  isReply: boolean;
}) {
  const [reply, setReply] = useState(false);
  const replies = all.filter((c) => c.parentId === comment.id);

  return (
    <li className={isReply ? "ml-8 mt-3" : ""}>
      <article
        className={`rounded-xl border border-line bg-white p-5 ${isReply ? "" : ""}`}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-medium">
            {comment.username}
            {isReply && (
              <span className="ml-2 text-xs text-muted">en respuesta</span>
            )}
          </span>
          <time className="text-xs text-muted">
            {formatTime(comment.createdAt)}
          </time>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {comment.content}
        </p>
        <button
          type="button"
          onClick={() => setReply((v) => !v)}
          className="mt-3 text-xs text-accent hover:underline"
        >
          {reply ? "Cancelar" : "Responder"}
        </button>
      </article>
      {reply && (
        <div className="ml-8 mt-3">
          <CommentForm articleId={articleId} parentId={comment.id} compact />
        </div>
      )}
      {replies.length > 0 && (
        <ul>
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              all={all}
              articleId={articleId}
              isReply
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentList({
  comments,
  articleId,
}: {
  comments: Comment[];
  articleId: string;
}) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay comentarios. ¡Sé la primera persona en comentar!
      </p>
    );
  }

  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <ul className="space-y-6">
      {topLevel.map((c) => (
        <CommentItem key={c.id} comment={c} all={comments} articleId={articleId} isReply={false} />
      ))}
    </ul>
  );
}

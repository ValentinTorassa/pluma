import type { Comment } from "@/db/schema";

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay comentarios. ¡Sé la primera persona en comentar!
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {comments.map((c) => (
        <li key={c.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium">{c.username}</span>
            <time className="text-xs text-muted">
              {new Intl.DateTimeFormat("es-AR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(c.createdAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
        </li>
      ))}
    </ul>
  );
}

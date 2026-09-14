import type { Metadata } from "next";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { getPendingComments } from "@/lib/data";
import { moderateComment } from "../../actions";

export const dynamic = "force-dynamic";

const m = messages.admin.comments;

export const metadata: Metadata = {
  title: messages.admin.nav.comments,
  robots: { index: false, follow: false },
};

export default async function CommentsPage() {
  const pending = await getPendingComments();

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">
        {`${m.title} (`}{pending.length})
      </h1>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {m.empty}
        </p>
      ) : (
        <ul className="space-y-4">
          {pending.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{c.username}</span>
                  <span className="ml-2 text-xs text-muted">
                    {`${m.inArticle} «`}{c.articleTitle}»
                  </span>
                </div>
                <time className="text-xs text-muted">
                  {new Intl.DateTimeFormat(config.locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(c.createdAt)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {c.content}
              </p>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <form action={moderateComment}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="action" value="approve" />
                  <button
                    type="submit"
                    className="rounded-full bg-green-700 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-800"
                  >
                    {m.approve}
                  </button>
                </form>
                <form action={moderateComment}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="action" value="delete" />
                  <button
                    type="submit"
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400"
                  >
                    {m.remove}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-muted">{m.footnote}</p>
    </div>
  );
}

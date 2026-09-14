import Link from "next/link";
import type { Metadata } from "next";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getAllArticles, parseTags } from "@/lib/data";
import { deleteArticle, toggleArticleStatus } from "../actions";

export const dynamic = "force-dynamic";

const m = messages.admin.articles;

export const metadata: Metadata = {
  title: m.title,
  robots: { index: false, follow: false },
};

export default async function AdminDashboard() {
  const rows = await getAllArticles();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">{m.title}</h1>
        <Link
          href="/admin/articulos/nuevo"
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent"
        >
          {m.newArticle}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          {m.empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">{m.columns.title}</th>
                <th className="px-4 py-3">{m.columns.status}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{m.columns.tags}</th>
                <th className="hidden px-4 py-3 md:table-cell">{m.columns.updated}</th>
                <th className="px-4 py-3 text-right">{m.columns.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articulos/${a.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        a.status === "published"
                          ? "bg-green-100 text-green-800"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {a.status === "published" ? m.published : m.draft}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {parseTags(a).join(", ")}
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {new Intl.DateTimeFormat(config.locale, { dateStyle: "short" }).format(
                      a.updatedAt,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {a.status === "published" && (
                        <Link
                          href={`/articulo/${a.slug}`}
                          target="_blank"
                          className="text-muted hover:text-ink"
                        >
                          {m.view}
                        </Link>
                      )}
                      <form action={toggleArticleStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="text-muted hover:text-ink">
                          {a.status === "published" ? m.unpublish : m.publish}
                        </button>
                      </form>
                      <form action={deleteArticle}>
                        <input type="hidden" name="id" value={a.id} />
                        <ConfirmButton
                          confirmText={m.deleteConfirm}
                          className="text-red-600 hover:text-red-800"
                        >
                          {m.delete}
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

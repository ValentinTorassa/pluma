import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { deleteSeries } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getSeriesAdminList } from "@/lib/series";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: publishing?.messages.series.title,
  robots: { index: false, follow: false },
};

/** /admin/series - series del blog (feature `series`). Solo se borran las que no tienen artículos. */
export default async function AdminSeriesPage() {
  if (!config.features.series || !publishing) notFound();
  const m = publishing.messages.series;
  const rows = await getSeriesAdminList();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">{m.title}</h1>
        <Link
          href="/admin/series/nueva"
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent"
        >
          {m.newSeries}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">{m.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">{m.columns.title}</th>
                <th className="hidden px-4 py-3 md:table-cell">{m.columns.slug}</th>
                <th className="px-4 py-3">{m.columns.published}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{m.columns.planned}</th>
                <th className="px-4 py-3 text-right">{m.columns.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ series: s, articles, published }) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/series/${s.id}`} className="font-medium hover:text-accent">
                      {s.title}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{s.slug}</td>
                  <td className="px-4 py-3 tabular-nums">{published}</td>
                  <td className="hidden px-4 py-3 text-muted tabular-nums sm:table-cell">
                    {s.plannedParts ?? m.open}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/serie/${s.slug}`} target="_blank" className="text-muted hover:text-ink">
                        {m.view}
                      </Link>
                      {articles === 0 ? (
                        <form action={deleteSeries}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton confirmText={m.deleteConfirm} className="text-red-600 hover:text-red-800">
                            {m.delete}
                          </ConfirmButton>
                        </form>
                      ) : (
                        <span className="text-muted" title={m.inUse}>
                          {m.inUse}
                        </span>
                      )}
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

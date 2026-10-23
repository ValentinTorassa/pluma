import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { clearCspReports } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { cspHeaderName } from "@/lib/csp";
import { MAX_CSP_ROWS } from "@/lib/csp-report";
import { getCspReports } from "@/lib/csp-reports";

export const dynamic = "force-dynamic";

const m = messages.admin.csp;

export const metadata: Metadata = {
  title: m.title,
  robots: { index: false, follow: false },
};

/**
 * /admin/csp - violaciones de la CSP agregadas (feature `cspReports`, tabla
 * csp_reports). Sirve para decidir cuándo pasar a PLUMA_CSP_ENFORCE=1 y para
 * ver qué se bloquea después.
 */
export default async function AdminCspPage() {
  if (!config.features.cspReports) notFound();
  const rows = await getCspReports();
  const enforcing = cspHeaderName() === "Content-Security-Policy";
  const date = new Intl.DateTimeFormat(config.locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: config.timeZone,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold">{m.title}</h1>
        {rows && rows.length > 0 ? (
          <form action={clearCspReports}>
            <ConfirmButton
              confirmText={m.clearConfirm}
              className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400"
            >
              {m.clear}
            </ConfirmButton>
          </form>
        ) : null}
      </div>
      <p className="text-sm text-muted">{m.intro}</p>
      <p className="mt-2 mb-6 text-sm font-medium">{enforcing ? m.modeEnforce : m.modeReport}</p>

      {rows === null ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-red-700">{m.missingTable}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">{m.empty}</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">
            {m.rows}
            {rows.length}
            {" / "}
            {MAX_CSP_ROWS}
          </p>
          {rows.length >= MAX_CSP_ROWS ? <p className="mb-4 text-sm text-red-700">{m.full}</p> : null}
          {/* Solo clases que el admin ya usa: el CSS de Tailwind es uno para todos los tenants */}
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">{m.columns.directive}</th>
                  <th className="px-3 py-2">{m.columns.blocked}</th>
                  <th className="px-3 py-2">{m.columns.path}</th>
                  <th className="px-3 py-2">{m.columns.mode}</th>
                  <th className="px-3 py-2 text-right">{m.columns.count}</th>
                  <th className="px-3 py-2">{m.columns.firstSeen}</th>
                  <th className="px-3 py-2">{m.columns.lastSeen}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={`${r.directive} ${r.blocked} ${r.path} ${r.disposition}`}>
                    <td className="px-3 py-2 font-mono text-xs">{r.directive}</td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-xs" title={r.blocked}>
                      {r.blocked}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-xs" title={r.path}>
                      {r.path}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.disposition}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-2 text-xs text-muted">{date.format(r.firstSeen)}</td>
                    <td className="px-3 py-2 text-xs">{date.format(r.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

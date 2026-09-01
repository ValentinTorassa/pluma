import type { Metadata } from "next";
import Link from "next/link";
import { getArchiveMonths } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archivo",
};

function monthLabel(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default async function ArchiveIndexPage() {
  const months = await getArchiveMonths();

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Archivo</h1>
      <p className="mt-3 text-muted">Todos los artículos publicados, agrupados por mes.</p>

      {months.length === 0 ? (
        <p className="mt-10 text-muted">Todavía no hay artículos publicados.</p>
      ) : (
        <ul className="mt-10 space-y-3">
          {months.map(({ year, month, count }) => (
            <li key={`${year}-${month}`}>
              <Link
                href={`/archivo/${year}/${String(month).padStart(2, "0")}`}
                className="group flex items-baseline justify-between border-b border-line py-4"
              >
                <span className="font-serif text-2xl font-semibold group-hover:text-accent">
                  {monthLabel(year, month)}
                </span>
                <span className="text-sm text-muted">
                  {count} {count === 1 ? "artículo" : "artículos"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

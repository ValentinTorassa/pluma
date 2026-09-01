import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArchiveMonths, getPublishedByMonth } from "@/lib/data";

export const dynamic = "force-dynamic";

function monthLabel(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export async function generateMetadata(
  props: PageProps<"/archivo/[year]/[month]">,
): Promise<Metadata> {
  const { year, month } = await props.params;
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m)) return { title: "Archivo" };
  return { title: monthLabel(y, m) };
}

export default async function ArchiveMonthPage(
  props: PageProps<"/archivo/[year]/[month]">,
) {
  const { year: yearParam, month: monthParam } = await props.params;
  const year = Number(yearParam);
  const month = Number(monthParam);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }

  const [rows, months] = await Promise.all([
    getPublishedByMonth(year, month),
    getArchiveMonths(),
  ]);
  if (!months.some((x) => x.year === year && x.month === month)) notFound();

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <p className="text-sm text-muted">
        <Link href="/archivo" className="link-underline hover:text-ink">
          ← Archivo
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">
        {monthLabel(year, month)}
      </h1>
      <p className="mt-2 text-muted">
        {rows.length} {rows.length === 1 ? "artículo" : "artículos"}
      </p>

      <ul className="mt-10 space-y-1">
        {rows.map((a) => (
          <li key={a.id} className="border-b border-line py-4">
            <Link href={`/articulo/${a.slug}`} className="group block">
              {a.publishedAt && (
                <time className="text-xs uppercase tracking-wider text-muted">
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
                    a.publishedAt,
                  )}
                </time>
              )}
              <h2 className="mt-1 font-serif text-xl font-semibold leading-snug group-hover:text-accent">
                {a.title}
              </h2>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

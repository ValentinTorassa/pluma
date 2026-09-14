import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { getArchiveMonths, getPublishedByMonth } from "@/lib/data";
import { monthLabel, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

const m = messages.archive;

export async function generateMetadata(
  props: PageProps<"/archivo/[year]/[month]">,
): Promise<Metadata> {
  const { year, month } = await props.params;
  const y = Number(year);
  const mo = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(mo)) return { title: m.title };
  return { title: monthLabel(y, mo) };
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
          {m.back}
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">
        {monthLabel(year, month)}
      </h1>
      <p className="mt-2 text-muted">
        {rows.length} {plural(rows.length, m.articles)}
      </p>

      <ul className="mt-10 space-y-1">
        {rows.map((a) => (
          <li key={a.id} className="border-b border-line py-4">
            <Link href={`/articulo/${a.slug}`} className="group block">
              {a.publishedAt && (
                <time className="text-xs uppercase tracking-wider text-muted">
                  {new Intl.DateTimeFormat(config.locale, { dateStyle: "medium" }).format(
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

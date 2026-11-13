import type { Metadata } from "next";
import Link from "next/link";
import { messages } from "@tenant/messages";
import { getArchiveMonths } from "@/lib/data";
import { monthLabel, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

const m = messages.archive;

export const metadata: Metadata = {
  title: m.title,
};

export default async function ArchiveIndexPage() {
  const months = await getArchiveMonths();

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{m.title}</h1>
      <p className="mt-3 text-muted">{m.intro}</p>

      {months.length === 0 ? (
        <p className="mt-10 text-muted">{m.empty}</p>
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
                  {count} {plural(count, m.articles)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

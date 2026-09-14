import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { SeriesForm } from "@/components/admin/SeriesForm";

export const metadata: Metadata = {
  title: publishing?.messages.series.newTitle,
  robots: { index: false, follow: false },
};

/** /admin/series/nueva (feature `series`) */
export default function NewSeriesPage() {
  if (!config.features.series || !publishing) notFound();
  const m = publishing.messages;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-serif text-3xl font-semibold">{m.series.newTitle}</h1>
      <SeriesForm labels={m.seriesForm} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { getSeriesById } from "@/lib/series";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: publishing?.messages.series.editTitle,
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/** /admin/series/[id] (feature `series`) */
export default async function EditSeriesPage(props: Props) {
  if (!config.features.series || !publishing) notFound();
  const { id } = await props.params;
  const series = await getSeriesById(id);
  if (!series) notFound();
  const m = publishing.messages;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-serif text-3xl font-semibold">{m.series.editTitle}</h1>
      <SeriesForm series={series} labels={m.seriesForm} />
    </div>
  );
}

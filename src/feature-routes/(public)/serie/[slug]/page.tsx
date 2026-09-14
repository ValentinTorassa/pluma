import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { seriesPage } from "@tenant/pages/series";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  if (!config.features.series || !seriesPage) return {};
  const { slug } = await props.params;
  return seriesPage.metadata({ slug });
}

export default async function SeriesRoute(props: Props) {
  if (!config.features.series || !seriesPage) notFound();
  const { slug } = await props.params;
  return seriesPage.Page({ slug });
}

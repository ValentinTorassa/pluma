import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { seriesPage } from "@tenant/pages/series";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/serie/[slug]">): Promise<Metadata> {
  if (!config.features.series || !seriesPage) return {};
  const { slug } = await props.params;
  return seriesPage.metadata({ slug });
}

export default async function SeriesRoute(props: PageProps<"/serie/[slug]">) {
  if (!config.features.series || !seriesPage) notFound();
  const { slug } = await props.params;
  const Page = seriesPage.Page;
  return <Page slug={slug} />;
}

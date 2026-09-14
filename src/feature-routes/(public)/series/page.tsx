import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { seriesIndexPage } from "@tenant/pages/series";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (!config.features.series || !seriesIndexPage) return {};
  return seriesIndexPage.metadata({});
}

export default async function SeriesIndexRoute() {
  if (!config.features.series || !seriesIndexPage) notFound();
  return seriesIndexPage.Page({});
}

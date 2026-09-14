import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { quincenaPage } from "@tenant/pages/quincena";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (!config.features.quincena || !quincenaPage) return {};
  return quincenaPage.metadata({});
}

export default async function QuincenaRoute() {
  if (!config.features.quincena || !quincenaPage) notFound();
  return quincenaPage.Page({});
}

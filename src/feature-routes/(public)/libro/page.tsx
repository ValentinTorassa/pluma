import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { bookPage } from "@tenant/pages/libro";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (!config.features.book || !bookPage) return {};
  return bookPage.metadata({});
}

export default async function BookRoute() {
  if (!config.features.book || !bookPage) notFound();
  return bookPage.Page({});
}

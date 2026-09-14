import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { apuntesPage } from "@tenant/pages/apuntes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (!config.features.apuntes || !apuntesPage) return {};
  return apuntesPage.metadata({});
}

export default async function ApuntesRoute() {
  if (!config.features.apuntes || !apuntesPage) notFound();
  return apuntesPage.Page({});
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { issuePage } from "@tenant/pages/apuntes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ numero: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  if (!config.features.apuntes || !issuePage) return {};
  const { numero } = await props.params;
  return issuePage.metadata({ number: numero });
}

export default async function IssueRoute(props: Props) {
  if (!config.features.apuntes || !issuePage) notFound();
  const { numero } = await props.params;
  return issuePage.Page({ number: numero });
}

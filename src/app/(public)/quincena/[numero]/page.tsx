import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { issuePage } from "@tenant/pages/quincena";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/quincena/[numero]">,
): Promise<Metadata> {
  if (!config.features.quincena || !issuePage) return {};
  const { numero } = await props.params;
  return issuePage.metadata({ number: numero });
}

export default async function IssueRoute(props: PageProps<"/quincena/[numero]">) {
  if (!config.features.quincena || !issuePage) notFound();
  const { numero } = await props.params;
  const Page = issuePage.Page;
  return <Page number={numero} />;
}

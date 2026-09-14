import type { Metadata } from "next";
import { homePage } from "@tenant/pages/home";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/">): Promise<Metadata> {
  return homePage.metadata({ searchParams: await props.searchParams });
}

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  return <homePage.Page searchParams={searchParams} />;
}

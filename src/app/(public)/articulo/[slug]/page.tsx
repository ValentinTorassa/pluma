import type { Metadata } from "next";
import { articlePage } from "@tenant/pages/article";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/articulo/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  return articlePage.metadata({ slug });
}

export default async function ArticleRoute(props: PageProps<"/articulo/[slug]">) {
  const { slug } = await props.params;
  return <articlePage.Page slug={slug} />;
}

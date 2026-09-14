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
  // Llamada directa (no <Page />): sin un límite de componente extra, el HTML
  // y el streaming quedan igual que cuando la página vivía en esta ruta.
  return articlePage.Page({ slug });
}

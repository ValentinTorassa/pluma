import type { Metadata } from "next";
import { articlePage } from "@tenant/pages/article";
import { config } from "@tenant/config";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/articulo/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const metadata = await articlePage.metadata({ slug });
  if (!config.features.agentAccess || !metadata.title) return metadata;
  // El mismo artículo en Markdown para agentes (/articulo/<slug>.md)
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: { ...metadata.alternates?.types, "text/markdown": `/articulo/${slug}.md` },
    },
  };
}

export default async function ArticleRoute(props: PageProps<"/articulo/[slug]">) {
  const { slug } = await props.params;
  // Llamada directa (no <Page />): sin un límite de componente extra, el HTML
  // y el streaming quedan igual que cuando la página vivía en esta ruta.
  return articlePage.Page({ slug });
}

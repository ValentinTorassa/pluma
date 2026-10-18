import type { Metadata, ResolvingMetadata } from "next";
import { homePage } from "@tenant/pages/home";
import { siteOpenGraph } from "@/lib/open-graph";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/">, parent: ResolvingMetadata): Promise<Metadata> {
  const metadata = await homePage.metadata({ searchParams: await props.searchParams });
  // og:url del home. El openGraph de una página reemplaza entero al del
  // layout, así que se repite la base del sitio y la imagen de
  // /opengraph-image (que ya resolvió el segmento de arriba).
  const images = (await parent).openGraph?.images;
  return { ...metadata, openGraph: { ...siteOpenGraph(), images, url: "/", ...metadata.openGraph } };
}

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  // Llamada directa (no <Page />): sin un límite de componente extra, el HTML
  // y el streaming quedan igual que cuando la página vivía en esta ruta.
  return homePage.Page({ searchParams });
}

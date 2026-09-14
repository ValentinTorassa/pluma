import type { Metadata } from "next";
import { homePage } from "@tenant/pages/home";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/">): Promise<Metadata> {
  return homePage.metadata({ searchParams: await props.searchParams });
}

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  // Llamada directa (no <Page />): sin un límite de componente extra, el HTML
  // y el streaming quedan igual que cuando la página vivía en esta ruta.
  return homePage.Page({ searchParams });
}

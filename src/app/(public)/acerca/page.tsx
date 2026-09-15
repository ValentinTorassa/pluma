import type { Metadata } from "next";
import { acercaPage } from "@tenant/pages/acerca";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return acercaPage.metadata({});
}

export default async function About() {
  // Llamada directa (no <Page />): sin un límite de componente extra, el HTML
  // y el RSC quedan igual que cuando la página vivía en esta ruta.
  return acercaPage.Page({});
}

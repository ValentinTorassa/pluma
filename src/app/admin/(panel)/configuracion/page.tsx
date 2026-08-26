import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Configuración",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-muted">
        Textos públicos del sitio. Se muestran en el home, la página Acerca de y el
        pie de página. Dejá un campo vacío para ocultarlo (email/LinkedIn).
      </p>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}

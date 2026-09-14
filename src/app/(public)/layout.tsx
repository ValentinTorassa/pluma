import { config } from "@tenant/config";
import { Footer } from "@tenant/slots/Footer";
import { Header } from "@tenant/slots/Header";
import { getSiteSettings } from "@/lib/settings";
import { BackToTop } from "@/components/BackToTop";
import { ReadingProgress } from "@/components/ReadingProgress";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const site = await getSiteSettings();

  return (
    <>
      <Header siteName={config.siteName} />
      <ReadingProgress />

      <main className="flex-1">{children}</main>

      <BackToTop />
      <Footer site={site} siteName={config.siteName} />
    </>
  );
}

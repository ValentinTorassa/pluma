import { config } from "@tenant/config";
import { Footer } from "@tenant/slots/Footer";
import { Header } from "@tenant/slots/Header";
import { hasSeries } from "@/lib/series";
import { getSiteSettings } from "@/lib/settings";
import { BackToTop } from "@/components/BackToTop";
import { ReadingProgress } from "@/components/ReadingProgress";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const [site, withSeries] = await Promise.all([
    getSiteSettings(),
    config.features.series ? hasSeries() : Promise.resolve(false),
  ]);

  return (
    <>
      {/* hasSeries solo con la feature: un tenant sin series recibe las mismas props que antes */}
      <Header siteName={config.siteName} {...(config.features.series ? { hasSeries: withSeries } : {})} />
      {config.features.readingTools && <ReadingProgress />}

      <main className="flex-1">{children}</main>

      {config.features.readingTools && <BackToTop />}
      <Footer site={site} siteName={config.siteName} />
    </>
  );
}

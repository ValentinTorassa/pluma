import Link from "next/link";
import { connection } from "next/server";
import { getLatestPosts } from "@/lib/issues";
import { getSeriesList } from "@/lib/series";
import { getSiteSettings } from "@/lib/settings";
import { config } from "../config";
import { copy } from "../messages";
import { Footer } from "../slots/Footer";
import { Header } from "../slots/Header";

const m = copy.notFound;

/**
 * 404 de VT (next.config.ts genera app/not-found.tsx a partir de este archivo).
 * Se renderiza fuera del layout público, por eso incluye header y footer.
 */
export default async function NotFound() {
  // Por request: sugiere lo último publicado, no lo que había al hacer el build
  await connection();
  const [site, [latest], series] = await Promise.all([
    getSiteSettings(),
    getLatestPosts(1),
    config.features.series ? getSeriesList() : Promise.resolve([]),
  ]);
  const firstSeries = series[0]?.series;

  return (
    <>
      <Header siteName={config.siteName} />
      <main className="flex-1">
        <div className="site">
          <div className="col nf">
            <svg viewBox="0 0 54 66" aria-hidden="true">
              <path
                d="M1 1 H37 L53 17 V65 H1 Z M37 1 V17 H53"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeDasharray="4 4"
              />
            </svg>
            <p className="code">{m.code}</p>
            <h1 className="t-display">{m.title}</h1>
            <p className="lede">
              {m.lede}
              {latest && firstSeries && (
                <>
                  {m.meanwhile}
                  <Link className="textlink" href={`/articulo/${latest.slug}`}>
                    {latest.title}
                  </Link>
                  {m.and}
                  <Link className="textlink" href={`/serie/${firstSeries.slug}`}>
                    {firstSeries.title}
                  </Link>
                  {m.end}
                </>
              )}
            </p>
            <p>
              <Link className="textlink" href="/">
                {m.home}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer site={site} siteName={config.siteName} />
    </>
  );
}

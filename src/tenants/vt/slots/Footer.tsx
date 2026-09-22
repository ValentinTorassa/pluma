import { Analytics } from "@vercel/analytics/next";
import { isAuthenticated } from "@/lib/auth";
import { PageBeacon } from "@/components/PageBeacon";
import type { FooterProps } from "../../types";
import { config } from "../config";
import { links } from "../links";
import { copy } from "../messages";

const m = copy.footer;

export async function Footer({ siteName }: FooterProps) {
  // Con sesión de admin no se cuenta la visita, igual que en el artículo
  const isAdmin = config.features.views ? await isAuthenticated() : false;

  const items = [
    { href: links.portfolio, label: m.portfolio },
    { href: links.youtube, label: m.youtube },
    { href: links.github, label: m.github },
    { href: links.discord, label: m.discord },
    ...(config.features.rss ? [{ href: "/feed.xml", label: m.rss }] : []),
  ].filter((i) => i.href);

  return (
    <div className="site">
      <footer className="ftr">
        <span>
          {siteName}
          {" · "}
          {links.domain}
        </span>
        <ul>
          {items.map((i) => (
            <li key={i.label}>
              <a href={i.href}>{i.label}</a>
            </li>
          ))}
        </ul>
      </footer>
      {/* Vercel Web Analytics: va en el footer del tenant, no en el layout
          compartido, así el bundle de yanina ni se entera. Sin cookies. */}
      <Analytics />

      {/* Contador propio de las páginas que no son artículo. Acá y no en el
          layout compartido por lo mismo que Analytics, y porque el footer es lo
          único del tenant que se pinta en todas: así /archivo y /buscar, que
          no tienen página de tenant, también cuentan. El artículo lo sigue
          contando ViewBeacon con su id. */}
      {config.features.views && !isAdmin && <PageBeacon />}
    </div>
  );
}

import { Analytics } from "@vercel/analytics/next";
import type { FooterProps } from "../../types";
import { config } from "../config";
import { links } from "../links";
import { copy } from "../messages";

const m = copy.footer;

export function Footer({ siteName }: FooterProps) {
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
    </div>
  );
}

import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import type { TenantPage } from "../../types";
import yuta from "../assets/yuta.webp";
import { links } from "../links";
import { alternates } from "../lib/seo";
import { copy } from "../messages";

const m = copy.about;

/** Redes y sitios, en el orden en que Valen los usa. Sin link, no se muestra. */
const PROFILES = [
  { href: links.portfolio, label: m.profiles.portfolio, handle: "valentorassa.com" },
  { href: links.youtube, label: m.profiles.youtube, handle: "@vtcibersecurity" },
  { href: links.discord, label: m.profiles.discord, handle: "DedSec" },
  { href: links.github, label: m.profiles.github, handle: "ValentinTorassa" },
  { href: links.linkedin, label: m.profiles.linkedin, handle: "in/valetorassa" },
  { href: links.x, label: m.profiles.x, handle: "@ValenSecurity" },
  { href: links.instagram, label: m.profiles.instagram, handle: "@vtsecurity" },
  { href: links.tiktok, label: m.profiles.tiktok, handle: "@vtsecurity" },
].filter((p) => p.href);

async function AcercaPage() {
  const site = await getSiteSettings();

  return (
    <div className="site">
      <div className="col page">
        <h1 className="t-display">{m.title}</h1>

        <div className="about-who">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="about-photo" src={yuta.src} alt="" width={72} height={72} />
          <p>
            <b>{site.authorName}</b>
            {site.authorRole}
          </p>
        </div>

        <div className="about-body">
          {m.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <section className="about-links">
          <h2 className="t-h2">{m.profilesTitle}</h2>
          <ul>
            {PROFILES.map((p) => (
              <li key={p.label}>
                <a href={p.href} rel="me noopener noreferrer" target="_blank">
                  {p.label}
                </a>
                <span className="about-handle">{p.handle}</span>
              </li>
            ))}
          </ul>
          <p className="about-note">
            {m.labsBefore}
            <a className="textlink" href={links.labs} rel="noopener noreferrer" target="_blank">
              {m.labsLink}
            </a>
            {m.labsAfter}
          </p>
        </section>
      </div>
    </div>
  );
}

export const acercaPage: TenantPage<Record<string, never>> = {
  Page: AcercaPage,
  metadata: async (): Promise<Metadata> => ({
    title: m.title,
    description: m.metaDescription,
    alternates: alternates("/acerca"),
  }),
};

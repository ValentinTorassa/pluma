import type { FooterProps } from "../../types";
import { messages } from "../messages";

export function Footer({ site, siteName }: FooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-10 text-xs uppercase tracking-widest text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.authorName} · {siteName}
        </p>
        <div className="flex gap-5">
          {site.authorEmail && (
            <a
              href={`mailto:${site.authorEmail}`}
              className="link-underline transition-colors hover:text-ink"
            >
              {messages.footer.contact}
            </a>
          )}
          {site.authorLinkedin && (
            <a
              href={site.authorLinkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline transition-colors hover:text-ink"
            >
              {messages.footer.linkedin}
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}

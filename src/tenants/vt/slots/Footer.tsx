import type { FooterProps } from "../../types";
import { messages } from "../messages";

/** TODO(phase4): footer definitivo (RSS, newsletter, redes). */
export function Footer({ site, siteName }: FooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-8 font-mono text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.authorName} · {siteName}
        </p>
        {site.authorLinkedin && (
          <a href={site.authorLinkedin} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
            {messages.footer.linkedin}
          </a>
        )}
      </div>
    </footer>
  );
}

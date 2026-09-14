import type { SiteSettings } from "@/lib/settings";
import type { TenantOg } from "../types";
import { config } from "./config";

/** Imágenes Open Graph (next/og). Las usan app/opengraph-image y api/og/[slug]. */
export const og = {
  alt: "Pluma",
  size: { width: 1200, height: 630 },

  site: (site: SiteSettings) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf8f4",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", color: "#9a3412", fontSize: 28, letterSpacing: 4 }}>
        PLUMA
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: "#1c1917" }}>
          {site.authorName}
        </div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#78716c" }}>
          {site.authorRole}
        </div>
      </div>
      <div style={{ display: "flex", color: "#9a3412", fontSize: 24 }}>
        {config.siteName}
      </div>
    </div>
  ),

  article: (title: string, site: SiteSettings) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf8f4",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", color: "#9a3412", fontSize: 28, letterSpacing: 4 }}>
        PLUMA
      </div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 80 ? 40 : 52,
          fontWeight: 600,
          color: "#1c1917",
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", color: "#78716c", fontSize: 24 }}>
        {site.authorName}
      </div>
    </div>
  ),
} satisfies TenantOg;

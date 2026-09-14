import type { SiteSettings } from "@/lib/settings";
import type { TenantOg } from "../types";
import { config } from "./config";
import { copy } from "./messages";

// Colores del tema claro de la maqueta v3 (ImageResponse no lee CSS)
const C = { bg: "#F5F5F2", ink: "#1D1E20", ink2: "#4B4E53", ink3: "#686C72", rule: "#E1E1DC" };

const frame = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: C.bg,
  padding: 80,
  fontFamily: "Georgia, serif",
} as const;

const brand = (
  <div style={{ display: "flex", fontSize: 30, color: C.ink }}>
    {config.siteName}
    <span style={{ marginLeft: 10, color: C.ink3 }}>{copy.brandSuffix}</span>
  </div>
);

export const og = {
  alt: `${config.siteName} ${copy.brandSuffix}`,
  size: { width: 1200, height: 630 },

  site: (site: SiteSettings) => (
    <div style={frame}>
      {brand}
      <div style={{ display: "flex", fontSize: 46, lineHeight: 1.3, color: C.ink, maxWidth: 980 }}>
        {site.siteDescription}
      </div>
      <div style={{ display: "flex", borderTop: `2px solid ${C.rule}`, paddingTop: 24, fontSize: 24, color: C.ink2 }}>
        {site.authorName}
      </div>
    </div>
  ),

  article: (title: string, site: SiteSettings) => (
    <div style={frame}>
      {brand}
      <div
        style={{
          display: "flex",
          fontSize: title.length > 80 ? 52 : 64,
          lineHeight: 1.08,
          color: C.ink,
          maxWidth: 1000,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", borderTop: `2px solid ${C.rule}`, paddingTop: 24, fontSize: 24, color: C.ink2 }}>
        {site.authorName}
      </div>
    </div>
  ),
} satisfies TenantOg;

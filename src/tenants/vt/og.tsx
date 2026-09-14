import type { SiteSettings } from "@/lib/settings";
import type { TenantOg } from "../types";
import { config } from "./config";

// TODO(phase4): diseño definitivo de las imágenes Open Graph.
const frame = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: "#07090e",
  padding: 72,
} as const;

const mark = { display: "flex", color: "#62dfd2", fontSize: 28, letterSpacing: 4 } as const;

export const og = {
  alt: "VT Security",
  size: { width: 1200, height: 630 },

  site: (site: SiteSettings) => (
    <div style={frame}>
      <div style={mark}>VT/SEC</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: "#f5f7fa" }}>{config.siteName}</div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#a9b4c4" }}>{site.siteDescription}</div>
      </div>
      <div style={{ display: "flex", color: "#9c8cff", fontSize: 24 }}>{site.authorName}</div>
    </div>
  ),

  article: (title: string, site: SiteSettings) => (
    <div style={frame}>
      <div style={mark}>VT/SEC</div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 80 ? 40 : 52,
          fontWeight: 600,
          color: "#f5f7fa",
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", color: "#a9b4c4", fontSize: 24 }}>{site.authorName}</div>
    </div>
  ),
} satisfies TenantOg;

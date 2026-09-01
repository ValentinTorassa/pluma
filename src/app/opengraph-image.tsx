import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/settings";
import { config } from "@/pluma.config";

export const alt = "Pluma";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const site = await getSiteSettings();

  return new ImageResponse(
    (
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
    { ...size },
  );
}

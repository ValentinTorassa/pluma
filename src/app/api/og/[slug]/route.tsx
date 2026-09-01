import { ImageResponse } from "next/og";
import { getPublishedBySlug } from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";
import { config } from "@/pluma.config";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const [article, site] = await Promise.all([
    getPublishedBySlug(slug),
    getSiteSettings(),
  ]);
  const title = article?.title ?? config.siteName;

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
    { width: 1200, height: 630 },
  );
}

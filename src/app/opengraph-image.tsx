import { ImageResponse } from "next/og";
import { og } from "@tenant/og";
import { getSiteSettings } from "@/lib/settings";

export const alt = og.alt;
export const size = og.size;
export const contentType = "image/png";

export default async function Image() {
  const site = await getSiteSettings();
  return new ImageResponse(og.site(site), { ...size });
}

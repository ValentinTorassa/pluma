import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_CDN_CACHE, PREVIEW_USER_AGENT } from "@/lib/preview-head";

const features = vi.hoisted(() => ({ previewBotHome: true }));
vi.mock("@tenant/config", () => ({ config: { features, lang: "es" } }));
const { GET: handler } = await import("@/feature-routes/api/preview-head/route");
const GET = () => handler(new NextRequest("https://vtsecurity.com.ar/api/preview-head"));

const home = `<!DOCTYPE html><html lang="es"><head><title>VT Security blog</title><meta property="og:title" content="VT Security blog"/><script nonce="abc">x()</script></head><body>contenido</body></html>`;

afterEach(() => {
  vi.unstubAllGlobals();
  features.previewBotHome = true;
});

describe("GET /api/preview-head", () => {
  it("asks the home for its head as itself, and lets the CDN keep the document", async () => {
    const fetchHome = vi.fn(async () => new Response(home, { status: 200 }));
    vi.stubGlobal("fetch", fetchHome);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(PREVIEW_CDN_CACHE);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toBe(
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>VT Security blog</title><meta property="og:title" content="VT Security blog"/></head><body></body></html>',
    );
    const [url, init] = fetchHome.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://vtsecurity.com.ar/");
    expect(new Headers(init.headers).get("user-agent")).toBe(PREVIEW_USER_AGENT);
  });

  it("is a 503 nobody caches when the home fails or has no og:title", async () => {
    for (const reply of [
      async () => new Response("caído", { status: 500 }),
      async () => new Response("<html><head><title>x</title></head></html>", { status: 200 }),
      async () => {
        throw new Error("timeout");
      },
    ]) {
      vi.stubGlobal("fetch", vi.fn(reply));
      const response = await GET();
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("does not exist without the feature", async () => {
    features.previewBotHome = false;
    vi.stubGlobal("fetch", vi.fn());
    await expect(GET()).rejects.toThrow();
  });
});

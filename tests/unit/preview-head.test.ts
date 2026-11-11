import { describe, expect, it } from "vitest";
import { PREVIEW_BOT, previewDocument, previewTags } from "@/lib/preview-head";

const home = `<!DOCTYPE html><html lang="es"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width"/><title>VT Security blog - Valentín Torassa</title><meta name="description" content="Lo que voy aprendiendo"/><link rel="canonical" href="https://vtsecurity.com.ar"/><link rel="alternate" type="application/rss+xml" href="https://vtsecurity.com.ar/feed.xml"/><meta property="og:title" content="VT Security blog"/><meta property="og:image" content="https://vtsecurity.com.ar/opengraph-image?2fca"/><meta name="twitter:card" content="summary_large_image"/><script nonce="abc">alert(1)</script></head><body><main>contenido</main></body></html>`;

describe("previewTags", () => {
  it("keeps only the preview tags of the head, in order", () => {
    expect(previewTags(home)).toBe(
      '<title>VT Security blog - Valentín Torassa</title><meta name="description" content="Lo que voy aprendiendo"/><link rel="canonical" href="https://vtsecurity.com.ar"/><meta property="og:title" content="VT Security blog"/><meta property="og:image" content="https://vtsecurity.com.ar/opengraph-image?2fca"/><meta name="twitter:card" content="summary_large_image"/>',
    );
  });

  it("leaves out scripts, the body and other meta tags", () => {
    const tags = previewTags(home) ?? "";
    expect(tags).not.toContain("<script");
    expect(tags).not.toContain("contenido");
    expect(tags).not.toContain("viewport");
    expect(tags).not.toContain("rss");
  });

  it("is null without a full head or without og:title", () => {
    expect(previewTags("<html><head><title>x</title>")).toBeNull();
    expect(previewTags("<html><head><title>x</title></head><body></body></html>")).toBeNull();
  });
});

describe("previewDocument", () => {
  it("wraps the tags in a document with no body", () => {
    expect(previewDocument("<title>x</title>", "es")).toBe(
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>x</title></head><body></body></html>',
    );
  });
});

describe("PREVIEW_BOT", () => {
  it("is Meta's link preview crawler only", () => {
    expect(PREVIEW_BOT.test("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(PREVIEW_BOT.test("meta-externalagent/1.1")).toBe(false);
    expect(PREVIEW_BOT.test("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0 Safari/537.36")).toBe(false);
  });
});

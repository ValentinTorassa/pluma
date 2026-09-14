import { describe, expect, it } from "vitest";
import { detectImageType, IMAGE_ACCEPT } from "@/lib/image-type";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("detectImageType", () => {
  it("detecta PNG, JPEG, GIF y WebP por magic bytes", () => {
    expect(detectImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0]))).toBe("image/png");
    expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(bytes("GIF89a", [1, 0]))).toBe("image/gif");
    expect(detectImageType(bytes("GIF87a"))).toBe("image/gif");
    expect(detectImageType(bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
  });

  it("rechaza SVG, HTML y archivos renombrados", () => {
    expect(detectImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageType(bytes("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(bytes("PNG but not really"))).toBeNull();
    expect(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt "))).toBeNull();
  });

  it("no revienta con archivos vacíos o truncados", () => {
    expect(detectImageType(new Uint8Array())).toBeNull();
    expect(detectImageType(bytes([0x89, 0x50]))).toBeNull();
    expect(detectImageType(bytes("RIFF"))).toBeNull();
  });

  it("el accept de los inputs no incluye SVG", () => {
    expect(IMAGE_ACCEPT).toBe("image/png,image/jpeg,image/webp,image/gif");
  });
});

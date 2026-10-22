import { describe, expect, it } from "vitest";
import { xmlEscape } from "../../src/lib/feed";

describe("RSS XML escaping", () => {
  it("removes forbidden XML 1.0 ASCII controls while preserving whitespace", () => {
    const controls = Array.from({ length: 32 }, (_, n) => String.fromCharCode(n)).join("");
    expect(xmlEscape(controls)).toBe("\t\n\r");
  });

  it("preserves multilingual text and escapes markup", () => {
    expect(xmlEscape('Niñez, café, 日本語 & <RSS> "uno"')).toBe(
      "Niñez, café, 日本語 &amp; &lt;RSS&gt; &quot;uno&quot;",
    );
  });
});

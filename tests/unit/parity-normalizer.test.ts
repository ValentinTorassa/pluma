import { describe, expect, it } from "vitest";
import { normalizeInlineScripts } from "../parity/script-normalizer.mjs";

describe("inline script parity normalization", () => {
  it.each([
    '<script nonce="build">payload</script>',
    "<SCRIPT>payload</ScRiPt>",
    "<script>payload</script\t\n bar>",
    '<script>payload</script foo="bar">',
  ])("normalizes HTML-accepted script variants: %s", (script) => {
    expect(normalizeInlineScripts("<p>stable</p>" + script + "<footer>end</footer>")).toBe(
      "<p>stable</p><script/><footer>end</footer>",
    );
  });

  it("preserves other elements and multiple script boundaries", () => {
    expect(normalizeInlineScripts("<script>a</script><b>keep</b><script>b</script>")).toBe(
      "<script/><b>keep</b><script/>",
    );
  });
});

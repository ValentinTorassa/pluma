import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|mts)$/.test(name) ? [full] : [];
  });
}

/** Generated from src/feature-routes by next.config.ts; ignored by git */
const GENERATED = /^\/\/ Generado por next\.config\.ts/;

describe("links del sitio público", () => {
  it("importan Link desde @/components/Link (sin prefetch), no desde next/link", () => {
    const offenders = files(SRC)
      .filter((file) => !file.includes(`${path.sep}admin${path.sep}`))
      .filter((file) => !file.endsWith(path.join("components", "Link.tsx")))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return !GENERATED.test(text) && /from ["']next\/link["']/.test(text);
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("el Link propio apaga el prefetch salvo que se pida", () => {
    const text = readFileSync(path.join(SRC, "components", "Link.tsx"), "utf8");
    expect(text).toMatch(/prefetch = false/);
    expect(text).toMatch(/<NextLink prefetch=\{prefetch\}/);
  });
});

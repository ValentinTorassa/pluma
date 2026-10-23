import { defineConfig, devices } from "@playwright/test";

/**
 * Chequeo de la CSP contra un deploy (o un build local), solo lectura:
 *
 *   BASE_URL=https://vtsecurity.com.ar npx playwright test -c tests/csp/playwright.config.ts
 *
 * Ver csp.spec.ts. Sirve en los dos modos: en Report-Only las violaciones
 * llegan igual como evento (`disposition: "report"`).
 */
const bypass = process.env.VERCEL_BYPASS_TOKEN;

export default defineConfig({
  testDir: ".",
  testMatch: "csp.spec.ts",
  outputDir: "../../test-results/csp",
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    locale: "es-AR",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

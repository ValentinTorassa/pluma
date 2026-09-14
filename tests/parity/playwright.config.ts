import { defineConfig, devices } from "@playwright/test";

/**
 * Paridad entre dos builds locales (misma SQLite de tests/parity/seed.mjs).
 *
 *   BASE_URL=http://localhost:3101 npx playwright test -c tests/parity/playwright.config.ts --update-snapshots
 *   BASE_URL=http://localhost:3102 npx playwright test -c tests/parity/playwright.config.ts
 *
 * El primer comando saca la referencia del build base; el segundo compara el
 * build nuevo contra esa referencia. Las capturas quedan en PARITY_SNAPSHOTS
 * (fuera del repo), porque dependen de la plataforma y del contenido sembrado.
 */
const snapshots = process.env.PARITY_SNAPSHOTS ?? "../../test-results/parity-snapshots";

export default defineConfig({
  testDir: ".",
  testMatch: "parity.spec.ts",
  snapshotPathTemplate: `${snapshots}/{arg}-{projectName}{ext}`,
  outputDir: "../../test-results/parity",
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  expect: {
    // Mismo build, mismo contenido: la tolerancia es solo antialiasing.
    toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3102",
    colorScheme: "light",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

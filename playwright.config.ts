import { defineConfig, devices } from "@playwright/test";

/**
 * Regresión visual. BASE_URL por defecto = producción.
 * Para un preview: BASE_URL=https://<preview>.vercel.app npm run test:visual
 */
const baseURL = process.env.BASE_URL ?? "https://yaninacolombero.com";
const bypass = process.env.VERCEL_BYPASS_TOKEN;

export default defineConfig({
  testDir: "./tests/visual",
  // Sin sufijo de plataforma: el mismo baseline sirve para producción y previews.
  // (Generado en macOS; correr las comparaciones en la misma plataforma.)
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL,
    colorScheme: "light",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
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

import { expect, test, type Page } from "@playwright/test";

/**
 * Baseline visual de yaninacolombero.com (tema claro, el default).
 * Las mismas capturas deben coincidir cuando BASE_URL apunta a un preview.
 *
 * Se enmascaran las regiones que cambian solas: tiempos relativos, contadores
 * de votos/comentarios, botón de upvote, comentarios y "relacionados".
 */

async function prepare(page: Page, path: string) {
  // Tema claro explícito aunque el navegador tuviera algo guardado.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pluma:theme", "light");
      localStorage.removeItem("pluma:font");
    } catch {
      /* ignore */
    }
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Carga todas las imágenes (lazy o no) antes de capturar.
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
    );
  });
}

function dynamicRegions(page: Page) {
  return [
    page.locator("article time"),
    page.locator('span[title="Votos"]'),
    page.locator('span[title="Comentarios"]'),
    page.locator("button[aria-pressed]"),
    page.locator("section.no-print"),
  ];
}

async function snap(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: dynamicRegions(page),
  });
}

test("home", async ({ page }) => {
  await prepare(page, "/");
  await snap(page, "home");
});

test("primer artículo", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const href = await page.locator('main a[href^="/articulo/"]').first().getAttribute("href");
  expect(href, "la home debería enlazar al menos un artículo").toBeTruthy();
  await prepare(page, href!);
  await snap(page, "articulo");
});

test("archivo", async ({ page }) => {
  await prepare(page, "/archivo");
  await snap(page, "archivo");
});

test("acerca", async ({ page }) => {
  await prepare(page, "/acerca");
  await snap(page, "acerca");
});

test("buscar", async ({ page }) => {
  await prepare(page, "/buscar");
  await snap(page, "buscar");
});

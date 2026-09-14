import { expect, test, type Page } from "@playwright/test";

/**
 * Capturas de página completa para comparar dos builds sobre la misma base
 * sembrada. No se enmascara nada: las fechas del seed son fijas (2024), así
 * que la única variación posible es un cambio real de render.
 */
export const PAGES: [name: string, path: string][] = [
  ["home", "/"],
  ["home-tag", "/?tag=pericias"],
  ["articulo", "/articulo/el-rol-de-la-pericia"],
  ["articulo-sin-portada", "/articulo/sin-portada"],
  ["archivo", "/archivo"],
  ["archivo-mes", "/archivo/2024/05"],
  ["acerca", "/acerca"],
  ["buscar", "/buscar"],
  ["buscar-resultados", "/buscar?q=pericia"],
  ["admin-login", "/admin/login"],
  ["404", "/no-existe"],
  // Rutas de features apagadas en yanina (series, La Quincena): 404 igual que antes
  ["serie-404", "/serie/linux-desde-cero"],
  ["quincena-404", "/quincena"],
];

async function prepare(page: Page, path: string, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("pluma:theme", t);
      localStorage.removeItem("pluma:font");
    } catch {
      /* ignore */
    }
  }, theme);
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
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

for (const [name, path] of PAGES) {
  test(name, async ({ page }) => {
    await prepare(page, path, "light");
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

// Modo noche (html.dark + tokens del tenant) en las dos páginas principales
for (const [name, path] of PAGES.filter(([n]) => n === "home" || n === "articulo")) {
  test(`${name} (noche)`, async ({ page }) => {
    await prepare(page, path, "dark");
    await expect(page).toHaveScreenshot(`${name}-dark.png`, { fullPage: true });
  });
}

// Interacciones de cliente: menú mobile y menú de lectura abiertos
test("menús abiertos", async ({ page }, info) => {
  await prepare(page, "/articulo/el-rol-de-la-pericia", "light");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menú" }).click();
  }
  await page.getByRole("button", { name: "Más opciones" }).locator("visible=true").click();
  await expect(page).toHaveScreenshot("menus.png");
});

import { expect, test, type Page } from "@playwright/test";

/**
 * ¿Bloquear con la CSP rompería algo? Por cada página: ningún evento
 * `securitypolicyviolation`, todos los <script> del HTML que sirvió el
 * servidor con el nonce del header (los que se agregan después los cubre
 * 'strict-dynamic') y la app hidratada (`window.next`). Solo lectura: los POST (visitas, analytics)
 * se cortan antes de salir, así que se puede correr contra producción sin
 * sumar nada. La CSP se evalúa antes de la red, así que un `connect-src` que
 * falle se ve igual.
 *
 * El 23/10/2026 producción fallaba esto en todas las páginas: los scripts de
 * Next salían sin nonce (ver NONCE_REQUEST_HEADER en src/lib/csp.ts).
 *
 * Páginas: las comunes a los tenants y el primer artículo del home; CSP_PATHS
 * (separadas por coma) suma otras, p. ej. `/series,/apuntes,/libro` en vt.
 *
 * Se ignora https://vercel.live: es la barra de Vercel, que solo aparece en
 * los previews (con PLUMA_CSP_ENFORCE=1 en Preview, la barra no carga).
 */
const PREVIEW_TOOLBAR = "https://vercel.live";
const PATHS = ["/", "/acerca", "/archivo", "/buscar?q=a", "/admin/login", "/no-existe"];
const EXTRA = (process.env.CSP_PATHS ?? "").split(",").map((p) => p.trim()).filter(Boolean);

async function check(page: Page, path: string) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspv: string[] }).__cspv = seen;
    document.addEventListener("securitypolicyviolation", (e) => {
      seen.push(`${e.disposition} ${e.effectiveDirective} ${e.blockedURI || "-"} (${e.sourceFile || "-"}:${e.lineNumber})`);
    });
  });
  await page.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));

  const res = await page.goto(path, { waitUntil: "load" });
  const headers = res?.headers() ?? {};
  const csp = headers["content-security-policy-report-only"] ?? "";
  const enforced = (headers["content-security-policy"] ?? "").includes("script-src");
  const policy = enforced ? headers["content-security-policy"] : csp;
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce, `${path}: sin nonce en la CSP`).toBeTruthy();

  // Los <script> ejecutables del HTML tal como salió (los JSON-LD no se ejecutan)
  const html = (await res?.text()) ?? "";
  const withoutNonce = (html.match(/<script\b[^>]*>/g) ?? [])
    .filter((tag) => !/type="application\/(ld\+)?json"/.test(tag))
    .filter((tag) => !tag.includes(`nonce="${nonce}"`));
  expect(withoutNonce, `${path}: <script> sin el nonce del header`).toEqual([]);

  await page.waitForLoadState("networkidle").catch(() => {});
  const state = await page.evaluate(() => ({
    hydrated: typeof (window as unknown as { next?: object }).next === "object",
    violations: (window as unknown as { __cspv: string[] }).__cspv,
  }));
  expect(state.violations.filter((v) => !v.includes(PREVIEW_TOOLBAR)), `${path}: violaciones`).toEqual([]);
  expect(state.hydrated, `${path}: no hidrató`).toBe(true);
}

for (const path of [...PATHS, ...EXTRA]) {
  test(`CSP ${path}`, async ({ page }) => {
    await check(page, path);
  });
}

test("CSP primer artículo del home", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('a[href^="/articulo/"]').first().getAttribute("href");
  test.skip(!href, "el home no tiene artículos");
  await check(page, href!);
});

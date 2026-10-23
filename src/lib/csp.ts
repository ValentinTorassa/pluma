/**
 * Content-Security-Policy estricta con nonce (la aplica src/proxy.ts por request).
 *
 * - script-src: solo scripts con el nonce del request ('strict-dynamic' deja
 *   que los chunks de Next carguen los que necesiten). Sin 'unsafe-inline'.
 * - style-src: 'unsafe-inline' porque React renderiza atributos style="" (p. ej.
 *   la barra de progreso de lectura). No lleva nonce: con nonce los navegadores
 *   ignoran 'unsafe-inline'.
 * - img-src: https: porque el avatar se puede pegar como URL externa y las
 *   imágenes subidas viven en *.public.blob.vercel-storage.com.
 * - report-uri / report-to: con la feature `cspReports`, los navegadores mandan
 *   cada violación a /api/csp-report (src/lib/csp-report.ts), tanto en
 *   Report-Only como bloqueando. `report-uri` lo usan Firefox y Safari;
 *   Chrome usa `report-to` con el header Reporting-Endpoints e ignora el otro.
 */
export function buildCsp(nonce: string, isDev = false, report = false): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(report ? [`report-uri ${CSP_REPORT_PATH}`, `report-to ${CSP_REPORT_GROUP}`] : []),
  ].join("; ");
}

/**
 * CSP base, que no puede romper el render (no restringe scripts ni estilos).
 * La pone next.config.ts, bloqueando, en las rutas que no pasan por el proxy
 * (API, assets). Las páginas no la llevan: tienen solo la estricta, que ya
 * trae estas directivas (ver src/proxy.ts).
 */
export const BASE_CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

/** Ruta que recibe los reportes (feature `cspReports`) */
export const CSP_REPORT_PATH = "/api/csp-report";

/** Nombre del endpoint en Reporting-Endpoints, el que cita `report-to` */
export const CSP_REPORT_GROUP = "csp";

/**
 * Header Reporting-Endpoints que define el endpoint de `report-to`. La URL va
 * relativa: el navegador la resuelve contra la página, así cada dominio y cada
 * preview reportan a sí mismos sin depender de qué origen ve el proxy detrás
 * de Vercel. Chrome solo lo toma en páginas https (en http://localhost no
 * reporta por acá, pero sí por `report-uri` si se saca `report-to`).
 */
export const REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

/**
 * Por ahora la política estricta va como Report-Only (se ven las violaciones en
 * la consola sin bloquear nada). Con PLUMA_CSP_ENFORCE=1 pasa a bloquear.
 */
export function cspHeaderName(): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return process.env.PLUMA_CSP_ENFORCE === "1"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

/**
 * Header del *request* del que Next.js saca el nonce para sus propios scripts
 * (chunks, payload RSC inline): lee `Content-Security-Policy` y, si no hay,
 * `…-Report-Only`. Siempre se pone este, también en Report-Only, para que un
 * header que mande el cliente no le gane. El request no lo ve el navegador.
 *
 * Ojo en Vercel: los headers de la *respuesta* (los de next.config.ts y los
 * que pone el proxy) le llegan al render también como headers del request y
 * pisan los de `requestHeaders`. Por eso una página tiene que salir con una
 * sola CSP, la que lleva el nonce: hasta el 23/10/2026 salía además la base
 * de next.config.ts (`Content-Security-Policy` sin nonce), Next leía esa, y
 * sus scripts salían sin nonce (el del tema sí: sale de `x-nonce`). Bloquear
 * habría dejado el sitio sin JavaScript. En `next start` local no pasa:
 * comprobarlo contra el deploy con tests/csp/.
 */
export const NONCE_REQUEST_HEADER = "Content-Security-Policy";

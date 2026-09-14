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
 */
export function buildCsp(nonce: string, isDev = false): string {
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
  ].join("; ");
}

/**
 * Por ahora la política estricta va como Report-Only (se ven las violaciones en
 * la consola sin bloquear nada). Con PLUMA_CSP_ENFORCE=1 pasa a bloquear.
 */
export function cspHeaderName(): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return process.env.PLUMA_CSP_ENFORCE === "1"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

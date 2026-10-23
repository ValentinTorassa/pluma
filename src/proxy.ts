import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { NONCE_REQUEST_HEADER, REPORTING_ENDPOINTS, buildCsp, cspHeaderName } from "@/lib/csp";
import { indexNowKeyFile } from "@/lib/indexnow";
import { config as tenantConfig } from "@tenant/config";

/**
 * 1. Protege /admin (excepto /admin/login). Chequeo optimista de la cookie de
 *    sesión; la verificación real se repite en el layout del panel y en cada
 *    server action.
 * 2. Genera un nonce por request y setea la CSP (Next.js lee el nonce del
 *    header del request y lo aplica a sus scripts; el layout lo usa para el
 *    script del tema). Con la feature `cspReports`, la política manda las
 *    violaciones a /api/csp-report (src/lib/csp.ts).
 * 3. Con INDEXNOW_KEY, sirve la clave en /<clave>.txt (src/lib/indexnow.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const indexNowKey = indexNowKeyFile(pathname);
  if (indexNowKey) {
    return new NextResponse(indexNowKey, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const valid = await verifySessionToken(token);

    if (pathname === "/admin/login") {
      // Si ya tiene sesión válida, directo al panel
      if (valid) return NextResponse.redirect(new URL("/admin", request.url));
    } else if (!valid) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const report = tenantConfig.features.cspReports;
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development", report);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(NONCE_REQUEST_HEADER, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Una sola CSP en la respuesta de una página (ver NONCE_REQUEST_HEADER): en
  // Vercel un `Content-Security-Policy` sin nonce en la respuesta le llega al
  // render y Next.js deja sus scripts sin nonce. El costo: mientras la estricta
  // va como Report-Only, sus object-src/base-uri/form-action solo reportan en
  // las páginas; el iframe lo sigue bloqueando X-Frame-Options (next.config.ts).
  response.headers.set(cspHeaderName(), csp);
  if (report) response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS);
  return response;
}

export const config = {
  matcher: [
    // El panel siempre pasa por el chequeo de sesión (también en prefetch)
    "/admin/:path*",
    // CSP para las páginas; se saltean API, assets estáticos y prefetches
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|images/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

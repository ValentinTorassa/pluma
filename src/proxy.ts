import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { buildCsp, cspHeaderName } from "@/lib/csp";

/**
 * 1. Protege /admin (excepto /admin/login). Chequeo optimista de la cookie de
 *    sesión; la verificación real se repite en el layout del panel y en cada
 *    server action.
 * 2. Genera un nonce por request y setea la CSP (Next.js lee el nonce del
 *    header del request y lo aplica a sus scripts; el layout lo usa para el
 *    script del tema).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const header = cspHeaderName();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(header, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, csp);
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

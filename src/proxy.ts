import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

/**
 * Protege /admin (excepto /admin/login).
 * Chequeo optimista de la cookie de sesión; la verificación real
 * se repite en el layout del panel y en cada server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("pluma_session")?.value;
  const valid = await verifySessionToken(token);

  if (pathname === "/admin/login") {
    // Si ya tiene sesión válida, directo al panel
    return valid
      ? NextResponse.redirect(new URL("/admin", request.url))
      : NextResponse.next();
  }

  if (!valid) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

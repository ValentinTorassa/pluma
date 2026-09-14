import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config } from "@tenant/config";
import { safeEqual } from "./utils";

const COOKIE_NAME = config.sessionCookie;
const SESSION_DAYS = 7;
const ISSUER = "pluma";

/**
 * Tenant de esta instancia: un token de otro blog (mismo AUTH_SECRET o no) no
 * sirve acá. Sale del tenant elegido en build (= PLUMA_TENANT, por defecto
 * "yanina"), así no depende de que la variable también exista en runtime.
 */
function getAudience() {
  return config.id;
}

export { COOKIE_NAME as SESSION_COOKIE };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(secret);
}

export async function createSession(username: string) {
  const token = await new SignJWT({ sub: username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(getAudience())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  });
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: getAudience(),
      algorithms: ["HS256"],
      requiredClaims: ["exp", "sub"],
    });
    return payload.role === "admin" && typeof payload.sub === "string" && payload.sub.length > 0;
  } catch {
    return false;
  }
}

/** Verifica la sesión leyendo la cookie (para Server Components / Actions) */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function checkCredentials(username: string, password: string): boolean {
  const envUser = process.env.ADMIN_USERNAME ?? "";
  const envPass = process.env.ADMIN_PASSWORD ?? "";
  if (!envUser || !envPass) return false;
  return safeEqual(username, envUser) && safeEqual(password, envPass);
}

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { safeEqual } from "./utils";

const COOKIE_NAME = "pluma_session";
const SESSION_DAYS = 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(secret);
}

export async function createSession(username: string) {
  const token = await new SignJWT({ sub: username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
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
    await jwtVerify(token, getSecret());
    return true;
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

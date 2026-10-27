import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/newsletter de punta a punta, sin red ni Turso: la base es una
 * SQLite en memoria con las migraciones, listmonk es un fetch falso y la IP
 * cambia en cada pedido para no chocar con el rate limit. La cookie de sesión
 * sale de `next/headers`, simulada con un jar como en view-route.test.ts.
 */
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({
  config: {
    id: "vt",
    sessionCookie: "pluma_vt_session",
    features: { newsletter: true },
    timeZone: "America/Argentina/Buenos_Aires",
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("@/lib/utils", () => {
  let n = 0;
  return { getClientIpHash: async () => `ip-de-test-${++n}` };
});
vi.mock("@/db", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/db/schema");
  const client = createClient({ url: ":memory:" });
  const dir = join(__dirname, "..", "..", "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  return { db: drizzle(client, { schema }) };
});

const { POST } = await import("@/feature-routes/api/newsletter/route");
const { db } = await import("@/db");
const { newsletterSignups } = await import("@/db/schema");
const { createChallenge } = await import("@/lib/altcha");
const { solveChallenge } = await import("@/lib/altcha-solve");
const { messages } = await import("@tenant/messages");

const KEY = "clave-de-test";
const ENDPOINT = "https://listmonk.invalid/api/public/subscription";
const COOKIE = "pluma_vt_session";
const SECRET = "secreto-de-prueba-de-al-menos-32-bytes";
const ENV = {
  AUTH_SECRET: SECRET,
  ALTCHA_HMAC_KEY: KEY,
  NEWSLETTER_SUBSCRIBE_URL: ENDPOINT,
  NEWSLETTER_LIST_UUIDS: "uuid-apuntes",
  NEWSLETTER_BOOK_LIST_UUIDS: "uuid-libro",
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response("{}", { status: 200 }),
);

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
const error = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(async () => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
  warn.mockClear();
  error.mockClear();
  jar.clear();
  await db.delete(newsletterSignups);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** El mismo token que firma createSession */
function sessionToken({ audience = "vt", secret = SECRET } = {}) {
  return new SignJWT({ sub: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pluma")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

/** Los motivos de rechazo que quedaron en el log, en orden */
function rejections() {
  return [...warn.mock.calls, ...error.mock.calls]
    .map(([line]) => String(line))
    .filter((line) => line.startsWith("[pluma] newsletter: rechazo "))
    .map((line) => JSON.parse(line.slice("[pluma] newsletter: rechazo ".length)) as Record<string, unknown>);
}

async function signups() {
  return db
    .select({ ref: newsletterSignups.ref, form: newsletterSignups.form, count: newsletterSignups.count })
    .from(newsletterSignups);
}

/** Un challenge chico resuelto, como el que manda el navegador */
async function altcha() {
  const raw = await solveChallenge(createChallenge(KEY, Date.now(), 500));
  expect(raw).not.toBeNull();
  return raw!;
}

async function post(body: unknown, raw = false) {
  const res = await POST(
    new NextRequest("http://localhost/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? String(body) : JSON.stringify(body),
    }),
  );
  return { status: res.status, data: (await res.json()) as { ok: boolean; message: string } };
}

/** Lo que recibió listmonk en el único llamado */
function sentToListmonk() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(ENDPOINT);
  return JSON.parse(String(init?.body)) as { email: string; list_uuids: string[] };
}

describe("POST /api/newsletter", () => {
  it("sin lista va a Apuntes, como siempre", async () => {
    const { status, data } = await post({ email: "Ana@Example.com", altcha: await altcha(), form: "nl-q" });
    expect(status).toBe(200);
    expect(data).toEqual({ ok: true, message: messages.api.newsletterThanks });
    expect(sentToListmonk()).toEqual({ email: "ana@example.com", list_uuids: ["uuid-apuntes"] });
  });

  it("list: apuntes es lo mismo que no mandarla", async () => {
    const { status } = await post({ email: "beto@example.com", altcha: await altcha(), list: "apuntes" });
    expect(status).toBe(200);
    expect(sentToListmonk().list_uuids).toEqual(["uuid-apuntes"]);
  });

  it("list: libro va a la lista de espera, con su mensaje, y cuenta como formulario libro", async () => {
    const { status, data } = await post({
      email: "caro@example.com",
      altcha: await altcha(),
      list: "libro",
      form: "nl-libro",
      ref: "youtube",
    });
    expect(status).toBe(200);
    expect(data).toEqual({ ok: true, message: messages.api.newsletterBookThanks });
    expect(sentToListmonk()).toEqual({ email: "caro@example.com", list_uuids: ["uuid-libro"] });

    const rows = await db.select().from(newsletterSignups).where(eq(newsletterSignups.form, "libro"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ref: "youtube", form: "libro", count: 1 });
  });

  it("libro sin NEWSLETTER_BOOK_LIST_UUIDS: 503 y no llama a listmonk", async () => {
    vi.stubEnv("NEWSLETTER_BOOK_LIST_UUIDS", "");
    const { status, data } = await post({ email: "dani@example.com", altcha: await altcha(), list: "libro" });
    expect(status).toBe(503);
    expect(data).toEqual({ ok: false, message: messages.api.newsletterUnavailable });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una lista desconocida es un pedido inválido y no cae en Apuntes", async () => {
    const { status, data } = await post({ email: "eva@example.com", altcha: await altcha(), list: "otra" });
    expect(status).toBe(400);
    expect(data).toEqual({ ok: false, message: messages.api.invalidRequest });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el libro también exige la prueba de trabajo", async () => {
    const { status, data } = await post({ email: "fede@example.com", list: "libro" });
    expect(status).toBe(400);
    expect(data).toEqual({ ok: false, message: messages.api.newsletterFailed });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("altas del admin", () => {
  it("sin sesión el alta se cuenta con su ref y su formulario", async () => {
    const { status } = await post({ email: "gabi@example.com", altcha: await altcha(), form: "nl-art", ref: "discord" });
    expect(status).toBe(200);
    expect(await signups()).toEqual([{ ref: "discord", form: "articulo", count: 1 }]);
  });

  it("con la sesión del admin va a listmonk igual, pero no se cuenta", async () => {
    jar.set(COOKIE, await sessionToken());
    const { status, data } = await post({ email: "admin@example.com", altcha: await altcha(), form: "nl-q", ref: "prueba" });
    expect(status).toBe(200);
    expect(data).toEqual({ ok: true, message: messages.api.newsletterThanks });
    expect(sentToListmonk().email).toBe("admin@example.com");
    expect(await signups()).toEqual([]);
  });

  it("una cookie que no es una sesión válida de este blog no frena el contador", async () => {
    for (const token of ["no-es-un-jwt", await sessionToken({ audience: "yanina" })]) {
      jar.set(COOKIE, token);
      expect((await post({ email: "hugo@example.com", altcha: await altcha(), form: "nl-home" })).status).toBe(200);
    }
    expect(await signups()).toEqual([{ ref: "directo", form: "home", count: 2 }]);
  });
});

describe("rechazos: un motivo por línea en el log", () => {
  it("body roto o que no es un objeto: body-invalido (y ya no un 500)", async () => {
    expect((await post("{no es json", true)).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect((await post(42)).status).toBe(400);
    expect(rejections()).toEqual([
      { reason: "body-invalido", status: 400 },
      { reason: "body-invalido", status: 400 },
      { reason: "body-invalido", status: 400 },
    ]);
  });

  it("lista desconocida, libro sin lista y mail inválido", async () => {
    await post({ email: "ines@example.com", list: "otra" });
    vi.stubEnv("NEWSLETTER_BOOK_LIST_UUIDS", "");
    await post({ email: "ines@example.com", list: "libro" });
    await post({ email: "no-es-un-mail", form: "nl-q" });
    expect(rejections()).toEqual([
      { reason: "lista-invalida", status: 400 },
      { reason: "lista-sin-configurar", status: 503, form: "libro" },
      { reason: "mail-invalido", status: 400, form: "apuntes" },
    ]);
  });

  it("sin NEWSLETTER_SUBSCRIBE_URL: sin-endpoint", async () => {
    vi.stubEnv("NEWSLETTER_SUBSCRIBE_URL", "");
    expect((await post({ email: "juan@example.com" })).status).toBe(503);
    expect(rejections()).toEqual([{ reason: "sin-endpoint", status: 503 }]);
  });

  it("captcha que no verifica y captcha usado dos veces", async () => {
    await post({ email: "kai@example.com", form: "nl-art" });
    await post({ email: "kai@example.com", form: "nl-art", altcha: "bm8tZXMtdW4tcGF5bG9hZA==" });
    const solved = await altcha();
    expect((await post({ email: "lu@example.com", altcha: solved, form: "nl-q" })).status).toBe(200);
    expect((await post({ email: "lu@example.com", altcha: solved, form: "nl-q" })).status).toBe(400);
    expect(rejections()).toEqual([
      { reason: "captcha-invalido", status: 400, form: "articulo" },
      { reason: "captcha-invalido", status: 400, form: "articulo" },
      { reason: "captcha-repetido", status: 400, form: "apuntes" },
    ]);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(error).not.toHaveBeenCalled();
  });

  it("listmonk 4xx, 5xx o sin respuesta: 502, con el status de listmonk, como error y sin contar", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 409 }));
    expect((await post({ email: "mia@example.com", altcha: await altcha(), form: "nl-q" })).status).toBe(502);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    expect((await post({ email: "mia@example.com", altcha: await altcha(), form: "nl-q" })).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await post({ email: "mia@example.com", altcha: await altcha(), form: "nl-q" })).status).toBe(502);
    expect(rejections()).toEqual([
      { reason: "listmonk-4xx", status: 502, form: "apuntes", upstream: 409 },
      { reason: "listmonk-5xx", status: 502, form: "apuntes", upstream: 503 },
      { reason: "listmonk-sin-respuesta", status: 502, form: "apuntes", error: "TypeError" },
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(await signups()).toEqual([]);
  });

  it("un alta aceptada no deja línea de rechazo", async () => {
    await post({ email: "nico@example.com", altcha: await altcha() });
    expect(rejections()).toEqual([]);
  });
});

import { SignJWT } from "jose";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/view de punta a punta, sin Turso: la base es una SQLite en memoria
 * con las migraciones, como en comandle-route.test.ts. La cookie de sesión y la
 * IP salen de `next/headers`, que fuera de un pedido de Next no existe: se
 * simulan con un jar que cada test llena.
 */
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({
  config: { id: "vt", sessionCookie: "pluma_vt_session", timeZone: "America/Argentina/Buenos_Aires" },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
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

const { POST } = await import("@/feature-routes/api/view/route");
const { db } = await import("@/db");
const { articles, articleViewHits, articleViews, pageViewHits, pageViews, rateLimits } = await import("@/db/schema");

const COOKIE = "pluma_vt_session";
const SECRET = "secreto-de-prueba-de-al-menos-32-bytes";
const ARTICLE = "art-1";

const env = { AUTH_SECRET: process.env.AUTH_SECRET, IP_SALT: process.env.IP_SALT };

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRET;
  process.env.IP_SALT = "sal-de-prueba";
  await db.insert(articles).values({ id: ARTICLE, slug: "permisos", title: "Permisos" });
});

afterAll(() => {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(async () => {
  jar.clear();
  for (const table of [articleViews, articleViewHits, pageViews, pageViewHits, rateLimits]) await db.delete(table);
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

function post(body: unknown) {
  return POST(
    new NextRequest("https://vtsecurity.com.ar/api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** Todo lo que escribe una visita: los dos agregados, los hits de dedupe y el rate limit */
async function writes() {
  let n = 0;
  for (const table of [articleViews, articleViewHits, pageViews, pageViewHits, rateLimits]) {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(table);
    n += Number(row?.n ?? 0);
  }
  return n;
}

describe("POST /api/view", () => {
  it("sin sesión cuenta el artículo y la página", async () => {
    expect(await (await post({ articleId: ARTICLE })).json()).toEqual({ ok: true, counted: true });
    expect(await (await post({ page: "/apuntes/3" })).json()).toEqual({ ok: true, counted: true });
    expect(await db.select({ views: articleViews.views }).from(articleViews)).toEqual([{ views: 1 }]);
    expect(await db.select({ page: pageViews.page, views: pageViews.views }).from(pageViews)).toEqual([
      { page: "apuntes-numero", views: 1 },
    ]);
  });

  it("/apuntes y un número de Apuntes suman en filas distintas", async () => {
    for (const page of ["/apuntes", "/apuntes/3", "/apuntes/4"]) {
      expect(await (await post({ page })).json()).toEqual({ ok: true, counted: true });
    }
    const rows = await db.select({ page: pageViews.page, views: pageViews.views }).from(pageViews).orderBy(pageViews.page);
    expect(rows).toEqual([
      { page: "apuntes", views: 1 },
      { page: "apuntes-numero", views: 2 },
    ]);
  });

  it("con la sesión del admin responde counted: false y no escribe nada", async () => {
    jar.set(COOKIE, await sessionToken());
    for (const body of [{ articleId: ARTICLE }, { page: "/apuntes/3" }, { page: "/" }]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(await res.json()).toEqual({ ok: true, counted: false });
    }
    expect(await writes()).toBe(0);
  });

  it("una cookie que no es una sesión válida de este blog no frena la visita", async () => {
    for (const token of [
      "no-es-un-jwt",
      await sessionToken({ audience: "yanina" }),
      await sessionToken({ secret: "otro-secreto-de-al-menos-32-bytes!!" }),
    ]) {
      jar.set(COOKIE, token);
      expect(await (await post({ page: "/acerca" })).json()).toEqual({ ok: true, counted: true });
    }
  });

  it("el body inválido sigue siendo 400 con o sin sesión", async () => {
    expect((await post({})).status).toBe(400);
    jar.set(COOKIE, await sessionToken());
    expect((await post({})).status).toBe(400);
    expect(await writes()).toBe(0);
  });
});

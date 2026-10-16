import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/newsletter de punta a punta, sin red ni Turso: la base es una
 * SQLite en memoria con las migraciones, listmonk es un fetch falso y la IP
 * cambia en cada pedido para no chocar con el rate limit.
 */
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({
  config: { features: { newsletter: true }, timeZone: "America/Argentina/Buenos_Aires" },
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
const ENV = {
  ALTCHA_HMAC_KEY: KEY,
  NEWSLETTER_SUBSCRIBE_URL: ENDPOINT,
  NEWSLETTER_LIST_UUIDS: "uuid-apuntes",
  NEWSLETTER_BOOK_LIST_UUIDS: "uuid-libro",
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response("{}", { status: 200 }),
);

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Un challenge chico resuelto, como el que manda el navegador */
async function altcha() {
  const raw = await solveChallenge(createChallenge(KEY, Date.now(), 500));
  expect(raw).not.toBeNull();
  return raw!;
}

async function post(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest("http://localhost/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

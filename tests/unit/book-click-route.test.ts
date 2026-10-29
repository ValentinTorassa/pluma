import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOK_ORIGINS, BOOK_REFS, bookRef } from "@/lib/book-event";

const state = vi.hoisted(() => ({ features: { book: true }, admin: false }));
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({ config: { features: state.features, timeZone: "America/Argentina/Buenos_Aires" } }));
vi.mock("@/lib/auth", () => ({ isAuthenticated: async () => state.admin }));
vi.mock("@/db", async () => {
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

const { POST, OPTIONS } = await import("@/feature-routes/api/book-click/route");
const { db } = await import("@/db");
const { bookClicks } = await import("@/db/schema");
const ORIGIN = "https://valentorassa.com";

beforeEach(async () => { await db.delete(bookClicks); });
afterEach(() => { state.features.book = true; state.admin = false; vi.useRealTimers(); vi.restoreAllMocks(); });

function post(body: string, origin: string | null = ORIGIN) {
  return POST(new NextRequest("http://localhost/api/book-click", {
    method: "POST", headers: { "content-type": "text/plain;charset=UTF-8", ...(origin ? { origin } : {}) }, body,
  }));
}

describe("aggregate book clicks", () => {
  it("counts repeated PDF and waitlist clicks separately, on the Argentina calendar day", async () => {
    vi.setSystemTime(new Date("2026-11-10T02:59:00Z"));
    for (const event of ["pdf", "pdf", "lista"]) {
      const response = await post(JSON.stringify({ event, ref: "muestra-linkedin" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, counted: true });
      expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(await db.select().from(bookClicks).orderBy(bookClicks.event)).toEqual([
      { day: "2026-11-09", event: "lista", ref: "muestra-linkedin", count: 1 },
      { day: "2026-11-09", event: "pdf", ref: "muestra-linkedin", count: 2 },
    ]);
  });

  it("collapses unknown refs and stores no extra request fields or visitor identifiers", async () => {
    await post(JSON.stringify({ event: "pdf", ref: "reader@example.test", ip: "192.0.2.1", userAgent: "test" }));
    await post(JSON.stringify({ event: "pdf", ref: "invented-campaign-42" }));
    const rows = await db.select().from(bookClicks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "pdf", ref: "otro", count: 2 });
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(book_clicks)`);
    expect(columns.map((column) => column.name)).toEqual(["day", "event", "ref", "count"]);
    expect(new Set(Array.from({ length: 1000 }, (_, i) => bookRef(`random-${i}`)))).toEqual(new Set(["otro"]));
    expect(BOOK_REFS).toHaveLength(20);
    expect(bookRef(" MUESTRA-X ")).toBe("muestra-x");
    expect(bookRef(undefined)).toBe("directo");
  });

  it("rejects missing, null and lookalike origins without counting", async () => {
    for (const origin of [null, "null", "http://valentorassa.com", "https://valentorassa.com.evil.test", "https://evil.test"]) {
      const response = await post('{"event":"pdf"}', origin);
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
    expect(await db.select().from(bookClicks)).toEqual([]);
  });

  it("rejects malformed, oversized or unknown events", async () => {
    for (const body of ["", "no-json", "[]", "null", '{"event":"signup"}', '{"ref":"muestra-x"}', JSON.stringify({ event: "pdf", extra: "x".repeat(512) })]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(await db.select().from(bookClicks)).toEqual([]);
  });

  it("excludes an authenticated admin when the request carries the session", async () => {
    state.admin = true;
    const response = await post('{"event":"lista","ref":"web-libro"}', "https://vtsecurity.com.ar");
    expect(await response.json()).toEqual({ ok: true, counted: false });
    expect(await db.select().from(bookClicks)).toEqual([]);
  });

  it("allows preflight only from the fixed production origins", async () => {
    for (const origin of BOOK_ORIGINS) {
      const response = await OPTIONS(new NextRequest("http://localhost/api/book-click", { method: "OPTIONS", headers: { origin } }));
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    }
    expect((await OPTIONS(new NextRequest("http://localhost/api/book-click", { method: "OPTIONS" }))).status).toBe(403);
  });

  it("is absent when the book feature is disabled", async () => {
    state.features.book = false;
    await expect(post('{"event":"pdf"}')).rejects.toThrow();
    await expect(OPTIONS(new NextRequest("http://localhost/api/book-click"))).rejects.toThrow();
  });

  it("reports counted:false when storage is unavailable, without logging the request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`DROP TABLE book_clicks`);
    try {
      const response = await post('{"event":"pdf","ref":"muestra-x"}');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, counted: false });
      expect(log).toHaveBeenCalledWith("[pluma] no se pudo contar el clic del libro, sigue de largo");
    } finally {
      await db.run(sql.raw(readFileSync(join(__dirname, "..", "..", "drizzle", "0010_book_clicks.sql"), "utf8")));
    }
  });
});

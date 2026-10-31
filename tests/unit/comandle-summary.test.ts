import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const features = vi.hoisted(() => ({ comandleStats: true }));
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({ config: { features, timeZone: "America/Argentina/Buenos_Aires" } }));
vi.mock("@/db", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/db/schema");
  const client = createClient({ url: ":memory:" });
  for (const stmt of readFileSync(join(__dirname, "../../drizzle/0007_comandle_daily.sql"), "utf8").split("--> statement-breakpoint")) {
    if (stmt.trim()) await client.execute(stmt);
  }
  return { db: drizzle(client, { schema }) };
});
const { db } = await import("@/db");
const { comandleDaily } = await import("@/db/schema");
const { GET: handler } = await import("@/feature-routes/api/comandle/route");
/** The summary is the GET without `?sala=` */
const GET = () => handler(new NextRequest("http://localhost/api/comandle"));

beforeEach(async () => {
  await db.delete(comandleDaily);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T03:01:00Z"));
});
afterEach(() => { features.comandleStats = true; vi.useRealTimers(); vi.restoreAllMocks(); });

describe("GET /api/comandle", () => {
  it("counts finished games since launch, including losses; excludes tests, visits and future rows", async () => {
    await db.insert(comandleDaily).values([
      { day: "2026-10-27", event: "finish", key: "1", count: 100 },
      { day: "2026-10-28", event: "finish", key: "3", count: 12 },
      { day: "2026-10-28", event: "finish", key: "x", count: 2 },
      { day: "2026-10-29", event: "finish", key: "2", count: 5 },
      { day: "2026-10-29", event: "start", key: "-", count: 50 },
      { day: "2026-10-29", event: "ref", key: "private-ref", count: 90 },
      { day: "2026-10-30", event: "finish", key: "1", count: 200 },
    ]);
    const before = await db.select().from(comandleDaily);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("max-age=30");
    const data = await response.json();
    expect(data.total).toBe(19);
    expect(data.today).toMatchObject({ date: "2026-10-29", played: 5, results: { 2: 5, x: 0 } });
    expect(data.yesterday).toMatchObject({ date: "2026-10-28", played: 14, results: { 3: 12, x: 2 } });
    expect(Object.keys(data.today.results)).toHaveLength(7);
    expect(JSON.stringify(data)).not.toContain("private-ref");
    expect(await db.select().from(comandleDaily)).toEqual(before);
  });

  it("changes days at Argentina midnight, rather than UTC midnight", async () => {
    await db.insert(comandleDaily).values({ day: "2026-10-28", event: "finish", key: "1", count: 2 });
    vi.setSystemTime(new Date("2026-10-29T02:59:59Z"));
    expect((await (await GET()).json()).today).toMatchObject({ date: "2026-10-28", played: 2 });
    vi.setSystemTime(new Date("2026-10-29T03:00:00Z"));
    const data = await (await GET()).json();
    expect(data.today).toMatchObject({ date: "2026-10-29", played: 0 });
    expect(data.yesterday).toMatchObject({ date: "2026-10-28", played: 2 });
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
    expect((await (await GET()).json()).yesterday.date).toBe("2026-12-31");
  });

  it("keeps the exact bytes and headers it had before rooms existed", async () => {
    await db.insert(comandleDaily).values([
      { day: "2026-10-28", event: "finish", key: "4", count: 3 },
      { day: "2026-10-29", event: "finish", key: "x", count: 1 },
      { day: "2026-10-29", event: "sala", key: "finish", count: 7 },
    ]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect([...response.headers]).toEqual([
      ["access-control-allow-origin", "*"],
      ["cache-control", "public, max-age=30, s-maxage=30"],
      ["content-type", "application/json"],
    ]);
    expect(await response.text()).toBe(
      '{"since":"2026-10-28","timeZone":"America/Argentina/Buenos_Aires","updatedAt":"2026-10-29T03:01:00.000Z","total":4,' +
        '"today":{"date":"2026-10-29","played":1,"results":{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"x":1}},' +
        '"yesterday":{"date":"2026-10-28","played":3,"results":{"1":0,"2":0,"3":0,"4":3,"5":0,"6":0,"x":0}}}',
    );
  });

  it("returns real zeros for an empty database and never writes a row", async () => {
    const data = await (await GET()).json();
    expect(data.total).toBe(0);
    expect(data.today.played).toBe(0);
    expect(await db.select().from(comandleDaily)).toEqual([]);
  });

  it("is absent for tenants without comandleStats", async () => {
    features.comandleStats = false;
    await expect(GET()).rejects.toThrow();
  });

  it("a missing table is an uncached 503, never a successful zero count", async () => {
    await db.run(sql`ALTER TABLE comandle_daily RENAME TO comandle_daily_offline`);
    try {
      const response = await GET();
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("");
    } finally {
      await db.run(sql`ALTER TABLE comandle_daily_offline RENAME TO comandle_daily`);
    }
  });
});

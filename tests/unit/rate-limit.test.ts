import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "@/lib/rate-limit";

/** SQLite en memoria con todas las migraciones de drizzle/ aplicadas */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  const dir = join(__dirname, "..", "..", "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  return drizzle(client, { schema });
}

const rule = { limit: 3, windowMs: 60_000 };

describe("rate limit", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("permite hasta el límite y bloquea el siguiente intento", async () => {
    const t = 1_000_000;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(db, "k", rule, t + i));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(await isRateLimited(db, "k", rule, t + 10)).toBe(true);
  });

  it("reinicia el contador cuando vence la ventana", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) await consumeRateLimit(db, "k", rule, t);
    expect(await isRateLimited(db, "k", rule, t + 1)).toBe(true);
    expect(await isRateLimited(db, "k", rule, t + rule.windowMs)).toBe(false);
    const next = await consumeRateLimit(db, "k", rule, t + rule.windowMs);
    expect(next).toEqual({ allowed: true, count: 1 });
  });

  it("las claves son independientes y reset borra el contador", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit(db, "a", rule);
    expect(await isRateLimited(db, "a", rule)).toBe(true);
    expect(await isRateLimited(db, "b", rule)).toBe(false);
    await resetRateLimit(db, "a");
    expect(await isRateLimited(db, "a", rule)).toBe(false);
  });

  it("fail-open si la tabla no existe (migración sin aplicar)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const empty = drizzle(createClient({ url: ":memory:" }), { schema });
    expect(await consumeRateLimit(empty, "k", rule)).toEqual({ allowed: true, count: 0 });
    expect(await isRateLimited(empty, "k", rule)).toBe(false);
    await expect(resetRateLimit(empty, "k")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

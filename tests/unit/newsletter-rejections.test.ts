import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El contador de rechazos de la newsletter contra una SQLite en memoria creada
 * con las migraciones de drizzle/ (la 0009 incluida), sin Turso.
 */
vi.mock("server-only", () => ({}));
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

const { db } = await import("@/db");
const { newsletterRejections } = await import("@/db/schema");
const { recordRejection } = await import("@/lib/newsletter-rejections");

beforeEach(async () => {
  await db.delete(newsletterRejections);
});

async function rows() {
  const all = await db.select().from(newsletterRejections);
  return all.sort((a, b) => `${a.day}${a.reason}${a.form}`.localeCompare(`${b.day}${b.reason}${b.form}`));
}

describe("recordRejection", () => {
  it("suma sobre la misma fila de día, motivo y formulario", async () => {
    expect(await recordRejection("2026-10-27", "captcha-invalido", "articulo")).toBe(true);
    expect(await recordRejection("2026-10-27", "captcha-invalido", "articulo")).toBe(true);
    expect(await recordRejection("2026-10-27", "captcha-invalido", "articulo")).toBe(true);
    expect(await rows()).toEqual([{ day: "2026-10-27", reason: "captcha-invalido", form: "articulo", count: 3 }]);
  });

  it("otro día, otro motivo u otro formulario es otra fila", async () => {
    await recordRejection("2026-10-27", "rate-limit", "apuntes");
    await recordRejection("2026-10-28", "rate-limit", "apuntes");
    await recordRejection("2026-10-27", "mail-invalido", "apuntes");
    await recordRejection("2026-10-27", "rate-limit", "libro");
    await recordRejection("2026-10-27", "body-invalido", "ninguno");
    expect(await rows()).toEqual([
      { day: "2026-10-27", reason: "body-invalido", form: "ninguno", count: 1 },
      { day: "2026-10-27", reason: "mail-invalido", form: "apuntes", count: 1 },
      { day: "2026-10-27", reason: "rate-limit", form: "apuntes", count: 1 },
      { day: "2026-10-27", reason: "rate-limit", form: "libro", count: 1 },
      { day: "2026-10-28", reason: "rate-limit", form: "apuntes", count: 1 },
    ]);
  });

  it("sin la tabla (deploy antes que la migración) devuelve false, lo deja en el log y no tira", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`DROP TABLE newsletter_rejections`);
    try {
      await expect(recordRejection("2026-10-27", "rate-limit", "apuntes")).resolves.toBe(false);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
      const migration = readFileSync(join(__dirname, "..", "..", "drizzle", "0009_newsletter_rejections.sql"), "utf8");
      await db.run(sql.raw(migration));
    }
  });
});

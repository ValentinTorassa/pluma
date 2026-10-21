import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/comandle de punta a punta, sin Turso: la base es una SQLite en
 * memoria con las migraciones. El pedido es como el del juego: JSON como texto,
 * sin Content-Type de JSON y con el Origin de comandle.
 */
const features = vi.hoisted(() => ({ comandleStats: true }));
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({
  config: { features, timeZone: "America/Argentina/Buenos_Aires" },
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

const { POST, OPTIONS } = await import("@/feature-routes/api/comandle/route");
const { db } = await import("@/db");
const { comandleDaily } = await import("@/db/schema");

const ORIGIN = "https://comandle.valentorassa.com";

afterEach(() => {
  features.comandleStats = true;
  vi.restoreAllMocks();
});

function post(body: string, headers: Record<string, string> = { origin: ORIGIN }) {
  return POST(
    new NextRequest("http://localhost/api/comandle", {
      method: "POST",
      // Lo que pone el navegador para un body string (pedido simple, sin preflight)
      headers: { "content-type": "text/plain;charset=UTF-8", ...headers },
      body,
    }),
  );
}

async function count(event: string, key: string) {
  const rows = await db
    .select()
    .from(comandleDaily)
    .where(and(eq(comandleDaily.event, event), eq(comandleDaily.key, key)));
  return rows.reduce((n, r) => n + r.count, 0);
}

async function total() {
  const [row] = await db.select({ n: sql<number>`coalesce(sum(${comandleDaily.count}), 0)` }).from(comandleDaily);
  return Number(row?.n ?? 0);
}

describe("POST /api/comandle", () => {
  it("un evento válido suma 1 por día, evento y clave, y responde 204 sin cuerpo", async () => {
    const res = await post(JSON.stringify({ event: "finish", key: "4" }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toBe("Origin");

    await post(JSON.stringify({ event: "finish", key: "4" }));
    expect(await count("finish", "4")).toBe(2);
    const [row] = await db.select().from(comandleDaily).where(eq(comandleDaily.key, "4"));
    expect(row?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ref y from se normalizan antes de contar", async () => {
    expect((await post(JSON.stringify({ event: "ref", key: "LinkedIn" }))).status).toBe(204);
    expect((await post(JSON.stringify({ event: "ref", key: "no es un ref" }))).status).toBe(204);
    expect((await post(JSON.stringify({ event: "from", key: "" }))).status).toBe(204);
    expect(await count("ref", "linkedin")).toBe(1);
    expect(await count("ref", "otro")).toBe(1);
    expect(await count("from", "ninguno")).toBe(1);
  });

  it("no exige Content-Type de JSON", async () => {
    const body = JSON.stringify({ event: "share", key: "-" });
    const form = { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" };
    expect((await post(body, form)).status).toBe(204);
    expect((await post(body, { origin: ORIGIN, "content-type": "application/json" })).status).toBe(204);
    expect(await count("share", "-")).toBe(2);
  });

  it("otro origen, o ninguno, es 403 y no cuenta", async () => {
    const before = await total();
    const body = JSON.stringify({ event: "start", key: "-" });
    expect((await post(body, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(body, { origin: "http://comandle.valentorassa.com" })).status).toBe(403);
    expect((await post(body, { origin: "https://comandle.valentorassa.com.evil.example" })).status).toBe(403);
    expect((await post(body, { origin: "null" })).status).toBe(403);
    expect((await post(body, {})).status).toBe(403);
    expect(await total()).toBe(before);
  });

  it("JSON roto, evento desconocido o clave fuera del conjunto es 400 y no cuenta", async () => {
    const before = await total();
    for (const body of [
      "",
      "no es json",
      '{"event":"start","key":"-"',
      "null",
      "[]",
      JSON.stringify({ event: "visit", key: "-" }),
      JSON.stringify({ event: "finish", key: "7" }),
      JSON.stringify({ event: "streak", key: "3" }),
      JSON.stringify({ event: "start" }),
    ]) {
      const res = await post(body);
      expect(res.status, body).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    }
    expect(await total()).toBe(before);
  });

  it("un body de más de 512 bytes es 400 aunque sea un evento válido", async () => {
    const before = await total();
    const body = JSON.stringify({ event: "start", key: "-", relleno: "a".repeat(512) });
    expect((await post(body)).status).toBe(400);
    expect(await total()).toBe(before);
  });

  it("con la feature apagada es 404", async () => {
    features.comandleStats = false;
    await expect(post(JSON.stringify({ event: "start", key: "-" }))).rejects.toThrow();
    await expect(OPTIONS()).rejects.toThrow();
  });

  it("sin la tabla (deploy antes que la migración) responde 204 igual y lo registra en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`DROP TABLE comandle_daily`);
    const res = await post(JSON.stringify({ event: "start", key: "-" }));
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("OPTIONS /api/comandle", () => {
  it("deja pasar el preflight del juego", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(res.headers.get("vary")).toBe("Origin");
  });
});

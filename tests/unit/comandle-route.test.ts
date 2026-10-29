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
const { comandleDaily, comandleHourly } = await import("@/db/schema");

const ORIGIN = "https://comandle.valentorassa.com";

afterEach(() => {
  features.comandleStats = true;
  vi.useRealTimers();
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

/** Las filas por hora de ese evento y clave, sin el conteo de los demás */
async function hourly(event: string, key: string) {
  return db
    .select()
    .from(comandleHourly)
    .where(and(eq(comandleHourly.event, event), eq(comandleHourly.key, key)))
    .orderBy(comandleHourly.day, comandleHourly.hour);
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

  it("cada evento suma también en su hora de llegada, en hora argentina", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 14:02 UTC es 11:02 ART: la hora del Short del 28/10
    vi.setSystemTime(new Date("2026-10-28T14:02:00Z"));
    await post(JSON.stringify({ event: "ref", key: "ig" }));
    await post(JSON.stringify({ event: "ref", key: "ig" }));
    vi.setSystemTime(new Date("2026-10-28T20:15:00Z"));
    await post(JSON.stringify({ event: "ref", key: "ig" }));
    expect(await hourly("ref", "ig")).toEqual([
      { day: "2026-10-28", hour: "11", event: "ref", key: "ig", count: 2 },
      { day: "2026-10-28", hour: "17", event: "ref", key: "ig", count: 1 },
    ]);
    // El total del día no cambia: es la suma de sus horas
    expect(await count("ref", "ig")).toBe(3);
  });

  it("a la medianoche argentina, el día y la hora cambian juntos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T02:59:59Z"));
    await post(JSON.stringify({ event: "finish", key: "6" }));
    vi.setSystemTime(new Date("2026-10-29T03:00:00Z"));
    await post(JSON.stringify({ event: "finish", key: "6" }));
    expect((await hourly("finish", "6")).map((r) => [r.day, r.hour, r.count])).toEqual([
      ["2026-10-28", "23", 1],
      ["2026-10-29", "00", 1],
    ]);
    const days = await db.select().from(comandleDaily).where(and(eq(comandleDaily.event, "finish"), eq(comandleDaily.key, "6")));
    expect(days.map((r) => [r.day, r.count]).sort()).toEqual([["2026-10-28", 1], ["2026-10-29", 1]]);
  });

  it("un evento que no cuenta tampoco suma hora", async () => {
    const before = await db.select().from(comandleHourly);
    await post(JSON.stringify({ event: "finish", key: "7" }));
    await post(JSON.stringify({ event: "start", key: "-" }), { origin: "https://evil.example" });
    expect(await db.select().from(comandleHourly)).toEqual(before);
  });

  it("sin la tabla por hora (deploy antes que la 0011) el día cuenta igual y queda en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`ALTER TABLE comandle_hourly RENAME TO comandle_hourly_offline`);
    try {
      const before = await count("share", "-");
      const res = await post(JSON.stringify({ event: "share", key: "-" }));
      expect(res.status).toBe(204);
      expect(await count("share", "-")).toBe(before + 1);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      await db.run(sql`ALTER TABLE comandle_hourly_offline RENAME TO comandle_hourly`);
    }
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
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(res.headers.get("vary")).toBe("Origin");
  });
});

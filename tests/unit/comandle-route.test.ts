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

const { GET, POST, OPTIONS } = await import("@/feature-routes/api/comandle/route");
const { db } = await import("@/db");
const { comandleDaily, comandleHourly, comandleRooms } = await import("@/db/schema");

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

/** Las filas de una sala, ordenadas por día y clave */
async function room(code: string) {
  return db.select().from(comandleRooms).where(eq(comandleRooms.room, code)).orderBy(comandleRooms.day, comandleRooms.key);
}

const sala = (key: string) => post(JSON.stringify({ event: "sala", key }));
const getSala = (query: string) => GET(new NextRequest(`http://localhost/api/comandle${query}`));

// Van antes que los de POST de siempre: el último de esos borra comandle_daily.
describe("POST /api/comandle con sala (modo clase)", () => {
  it("suma en la sala por día y qué pasó, y en el día y la hora solo sala sin código", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T13:10:00Z")); // 10:10 ART
    for (const key of ["K7QZ:start", "K7QZ:start", "K7QZ:start", "K7QZ:3", "K7QZ:x", "MNPQ:start"]) {
      const res = await sala(key);
      expect(res.status, key).toBe(204);
      expect(await res.text()).toBe("");
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    }
    expect(await room("K7QZ")).toEqual([
      { day: "2026-11-03", room: "K7QZ", key: "3", count: 1 },
      { day: "2026-11-03", room: "K7QZ", key: "start", count: 3 },
      { day: "2026-11-03", room: "K7QZ", key: "x", count: 1 },
    ]);
    expect(await room("MNPQ")).toEqual([{ day: "2026-11-03", room: "MNPQ", key: "start", count: 1 }]);

    // Al día y a la hora llega el evento sin el código: dos claves, no una por sala
    expect(await count("sala", "start")).toBe(4);
    expect(await count("sala", "finish")).toBe(2);
    expect((await hourly("sala", "start")).map((r) => [r.day, r.hour, r.count])).toEqual([["2026-11-03", "10", 4]]);
    expect((await hourly("sala", "finish")).map((r) => [r.day, r.hour, r.count])).toEqual([["2026-11-03", "10", 2]]);
    const daily = await db.select().from(comandleDaily).where(eq(comandleDaily.event, "sala"));
    const perHour = await db.select().from(comandleHourly).where(eq(comandleHourly.event, "sala"));
    expect(new Set(daily.map((r) => r.key))).toEqual(new Set(["start", "finish"]));
    expect(new Set(perHour.map((r) => r.key))).toEqual(new Set(["start", "finish"]));
    expect(JSON.stringify([daily, perHour])).not.toMatch(/K7QZ|MNPQ/);
    // Y no se confunde con las partidas del día
    expect(await count("start", "-")).toBe(0);
    expect(await count("finish", "3")).toBe(0);
  });

  it("la sala cambia de día a la medianoche argentina, como el resto", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T02:59:59Z"));
    await sala("RSTU:2");
    vi.setSystemTime(new Date("2026-11-04T03:00:00Z"));
    await sala("RSTU:2");
    expect((await room("RSTU")).map((r) => [r.day, r.key, r.count])).toEqual([
      ["2026-11-03", "2", 1],
      ["2026-11-04", "2", 1],
    ]);
  });

  it("un código o un resultado inválido es 400 y no cuenta en ningún lado", async () => {
    const before = [await total(), await db.select().from(comandleHourly), await db.select().from(comandleRooms)];
    for (const key of ["k7qz:start", "K7Q:start", "K7QZ1:start", "I7QZ:start", "K7QZ:7", "K7QZ:X", "K7QZ:finish", "K7QZ", "K7QZ:start:1", ""]) {
      const res = await sala(key);
      expect(res.status, key).toBe(400);
    }
    expect((await post(JSON.stringify({ event: "sala", key: 3 }))).status).toBe(400);
    expect((await post(JSON.stringify({ event: "sala", key: "K7QZ:start" }), { origin: "https://evil.example" })).status).toBe(403);
    expect([await total(), await db.select().from(comandleHourly), await db.select().from(comandleRooms)]).toEqual(before);
  });

  it("sin comandle_rooms (deploy antes que la 0012) responde 204, el día cuenta y queda en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`ALTER TABLE comandle_rooms RENAME TO comandle_rooms_offline`);
    try {
      const before = await count("sala", "finish");
      const res = await sala("VWXY:5");
      expect(res.status).toBe(204);
      expect(await count("sala", "finish")).toBe(before + 1);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      await db.run(sql`ALTER TABLE comandle_rooms_offline RENAME TO comandle_rooms`);
    }
    expect(await room("VWXY")).toEqual([]);
  });
});

describe("GET /api/comandle?sala=", () => {
  it("devuelve lo de esa sala hoy: empezaron, terminaron y en cuántos intentos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
    await db.insert(comandleRooms).values([
      { day: "2026-11-05", room: "H4CK", key: "start", count: 30 },
      { day: "2026-11-05", room: "H4CK", key: "1", count: 1 },
      { day: "2026-11-05", room: "H4CK", key: "3", count: 9 },
      { day: "2026-11-05", room: "H4CK", key: "6", count: 2 },
      { day: "2026-11-05", room: "H4CK", key: "x", count: 4 },
      // Otra sala, el mismo código otro día y una clave que no es de sala: no entran
      { day: "2026-11-05", room: "H4CX", key: "3", count: 50 },
      { day: "2026-11-04", room: "H4CK", key: "3", count: 70 },
      { day: "2026-11-05", room: "H4CK", key: "basura", count: 80 },
    ]);
    const before = await db.select().from(comandleRooms);
    const res = await getSala("?sala=H4CK");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, max-age=5, s-maxage=5");
    expect(await res.text()).toBe(JSON.stringify({
      sala: "H4CK",
      date: "2026-11-05",
      timeZone: "America/Argentina/Buenos_Aires",
      updatedAt: "2026-11-05T15:00:00.000Z",
      started: 30,
      played: 16,
      results: { 1: 1, 2: 0, 3: 9, 4: 0, 5: 0, 6: 2, x: 4 },
    }));
    // Leer no escribe nada
    expect(await db.select().from(comandleRooms)).toEqual(before);
  });

  it("lo que manda el juego se lee en la sala, y una sala sin partidas son ceros de verdad", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T22:00:00Z"));
    await sala("ZZ99:start");
    await sala("ZZ99:start");
    await sala("ZZ99:4");
    expect(await (await getSala("?sala=ZZ99")).json()).toMatchObject({ sala: "ZZ99", date: "2026-11-06", started: 2, played: 1, results: { 4: 1 } });
    const empty = await (await getSala("?sala=2345")).json();
    expect(empty).toMatchObject({ sala: "2345", date: "2026-11-06", started: 0, played: 0 });
    expect(Object.values(empty.results)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(Object.keys(empty.results)).toEqual(["1", "2", "3", "4", "5", "6", "x"]);
    // Al día siguiente (ART) la sala arranca de cero
    vi.setSystemTime(new Date("2026-11-07T03:00:00Z"));
    expect(await (await getSala("?sala=ZZ99")).json()).toMatchObject({ date: "2026-11-07", started: 0, played: 0 });
  });

  it("un código inválido es 400 sin caché, con CORS para que la pantalla lo lea", async () => {
    for (const query of ["?sala=", "?sala=h4ck", "?sala=H4C", "?sala=H4CKS", "?sala=I0O1", "?sala=H4C%20", "?sala=H4CK:start", "?sala"]) {
      const res = await getSala(query);
      expect(res.status, query).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(await res.text()).toBe("");
    }
  });

  it("si no se puede leer (o falta la 0012) es 503 sin caché, nunca ceros", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`ALTER TABLE comandle_rooms RENAME TO comandle_rooms_offline`);
    try {
      const res = await getSala("?sala=H4CK");
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(await res.text()).toBe("");
      expect(log).toHaveBeenCalledOnce();
    } finally {
      await db.run(sql`ALTER TABLE comandle_rooms_offline RENAME TO comandle_rooms`);
    }
  });

  it("sin sala sigue siendo el resumen de siempre", async () => {
    const data = await (await getSala("")).json();
    expect(Object.keys(data)).toEqual(["since", "timeZone", "updatedAt", "total", "today", "yesterday"]);
    expect(data).not.toHaveProperty("sala");
  });

  it("con la feature apagada es 404", async () => {
    features.comandleStats = false;
    await expect(getSala("?sala=H4CK")).rejects.toThrow();
  });
});

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

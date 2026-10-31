import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { comandleDaily } from "@/db/schema";
import {
  MAX_BODY_BYTES,
  ROOM_ALPHABET,
  ROOM_CODE,
  comandleEvent,
  readCappedText,
  referrerHost,
  roomCode,
  roomKey,
  siteHour,
} from "@/lib/comandle-event";

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

describe("eventos de comandle", () => {
  it("ref: el ?ref= del link, con las reglas de la newsletter", () => {
    expect(comandleEvent({ event: "ref", key: "charla-owasp" })).toEqual({ event: "ref", key: "charla-owasp" });
    expect(comandleEvent({ event: "ref", key: "Discord" })).toEqual({ event: "ref", key: "discord" });
    expect(comandleEvent({ event: "ref", key: "directo" })).toEqual({ event: "ref", key: "directo" });
    expect(comandleEvent({ event: "ref", key: "" })).toEqual({ event: "ref", key: "directo" });
    expect(comandleEvent({ event: "ref", key: "<script>" })).toEqual({ event: "ref", key: "otro" });
    expect(comandleEvent({ event: "ref", key: "a".repeat(49) })).toEqual({ event: "ref", key: "otro" });
  });

  it("from: host del referrer en minúsculas, ninguno sin referrer y otro si no parece un host", () => {
    expect(comandleEvent({ event: "from", key: "www.linkedin.com" })).toEqual({ event: "from", key: "www.linkedin.com" });
    expect(comandleEvent({ event: "from", key: "T.CO" })).toEqual({ event: "from", key: "t.co" });
    expect(comandleEvent({ event: "from", key: "ninguno" })).toEqual({ event: "from", key: "ninguno" });
    expect(comandleEvent({ event: "from", key: "" })).toEqual({ event: "from", key: "ninguno" });
    expect(referrerHost("https://t.co/abc")).toBe("otro");
    expect(referrerHost("example.com:8080")).toBe("otro");
    expect(referrerHost("a".repeat(65))).toBe("otro");
    expect(referrerHost("a".repeat(64))).toBe("a".repeat(64));
  });

  it("start y share: solo la clave -", () => {
    expect(comandleEvent({ event: "start", key: "-" })).toEqual({ event: "start", key: "-" });
    expect(comandleEvent({ event: "share", key: "-" })).toEqual({ event: "share", key: "-" });
    expect(comandleEvent({ event: "start", key: "1" })).toBeNull();
    expect(comandleEvent({ event: "share", key: "" })).toBeNull();
  });

  it("finish: ganó en 1..6 o perdió (x)", () => {
    for (const key of ["1", "2", "3", "4", "5", "6", "x"]) {
      expect(comandleEvent({ event: "finish", key })).toEqual({ event: "finish", key });
    }
    for (const key of ["0", "7", "X", " 1", "-", "won"]) {
      expect(comandleEvent({ event: "finish", key })).toBeNull();
    }
  });

  it("streak: solo los tramos", () => {
    for (const key of ["1", "2-3", "4-7", "8-14", "15+"]) {
      expect(comandleEvent({ event: "streak", key })).toEqual({ event: "streak", key });
    }
    for (const key of ["0", "2", "15", "16", "15 +", "-"]) {
      expect(comandleEvent({ event: "streak", key })).toBeNull();
    }
  });

  it("sala: CÓDIGO:start o CÓDIGO:resultado, con la sala y qué pasó aparte", () => {
    for (const what of ["start", "1", "2", "3", "4", "5", "6", "x"]) {
      expect(comandleEvent({ event: "sala", key: `K7QZ:${what}` })).toEqual({ event: "sala", key: `K7QZ:${what}`, room: "K7QZ", what });
    }
    // Todo el alfabeto sirve, en cualquier posición
    for (let i = 0; i < ROOM_ALPHABET.length; i += 4) {
      const code = ROOM_ALPHABET.slice(i, i + 4);
      expect(comandleEvent({ event: "sala", key: `${code}:start` })).toMatchObject({ room: code, what: "start" });
    }
    expect(comandleEvent({ event: "sala", key: "AAAA:x" })).toMatchObject({ room: "AAAA", what: "x" });
    expect(comandleEvent({ event: "sala", key: "9999:6" })).toMatchObject({ room: "9999", what: "6" });
  });

  it("sala: un código o un qué fuera del conjunto no se cuenta", () => {
    for (const key of [
      "",
      "K7QZ",
      "K7QZ:",
      ":start",
      "k7qz:start", // solo mayúsculas: el juego normaliza antes de mandar
      "K7Qz:start",
      "K7Q:start",
      "K7QZA:start",
      "I7QZ:start", // sin I, O, 0 ni 1
      "O7QZ:start",
      "07QZ:start",
      "17QZ:start",
      "K7-Z:start",
      "K7 Z:start",
      " K7QZ:start",
      "K7QZ:start ",
      "K7QZ :start",
      "K7QZ:Start",
      "K7QZ:START",
      "K7QZ:finish",
      "K7QZ:-",
      "K7QZ:0",
      "K7QZ:7",
      "K7QZ:X",
      "K7QZ:10",
      "K7QZ:start:1",
      "K7QZ::start",
      "K7QZ;start",
      "K7QZ/start",
      "ＫＱＺ７:start", // ancho completo
      "K7QΖ:start", // zeta griega
    ]) {
      expect(comandleEvent({ event: "sala", key }), key).toBeNull();
    }
    expect(comandleEvent({ event: "sala", key: 1 })).toBeNull();
    expect(comandleEvent({ event: "sala" })).toBeNull();
    expect(comandleEvent({ event: "SALA", key: "K7QZ:start" })).toBeNull();
    // Los campos que sobran se ignoran también acá
    expect(comandleEvent({ event: "sala", key: "K7QZ:3", nombre: "Ana" })).toEqual({ event: "sala", key: "K7QZ:3", room: "K7QZ", what: "3" });
  });

  it("el alfabeto de sala: 32 caracteres distintos, mayúsculas y cifras, sin I, O, 0 ni 1", () => {
    expect(ROOM_ALPHABET).toHaveLength(32);
    expect(new Set(ROOM_ALPHABET).size).toBe(32);
    expect(ROOM_ALPHABET).toMatch(/^[A-Z2-9]+$/);
    for (const ch of "IO01") expect(ROOM_ALPHABET).not.toContain(ch);
    expect(ROOM_CODE.test("ABCD")).toBe(true);
    expect(ROOM_CODE.test("ABCDE")).toBe(false);
    expect(roomCode("Z9Z9")).toBe("Z9Z9");
    expect(roomCode("z9z9")).toBeNull();
    expect(roomCode(null)).toBeNull();
    expect(roomCode(["ABCD"])).toBeNull();
    expect(roomKey("ABCD:x")).toEqual({ room: "ABCD", what: "x" });
    expect(roomKey("ABCD:toString")).toBeNull();
  });

  it("siteHour: 00..23 en la zona del sitio, y la medianoche es 00, no 24", () => {
    const tz = "America/Argentina/Buenos_Aires";
    // 02:59 UTC del 29/10 es 23:59 ART del 28/10; un segundo después, 00 del 29/10
    expect(siteHour(tz, new Date("2026-10-29T02:59:59Z"))).toBe("23");
    expect(siteHour(tz, new Date("2026-10-29T03:00:00Z"))).toBe("00");
    expect(siteHour(tz, new Date("2026-10-28T14:02:00Z"))).toBe("11");
    expect(siteHour("UTC", new Date("2026-10-28T09:30:00Z"))).toBe("09");
    const hours = new Set(Array.from({ length: 24 }, (_, h) => siteHour(tz, new Date(Date.UTC(2026, 9, 28, h, 30)))));
    expect([...hours].sort()).toEqual(Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")));
  });

  it("un evento desconocido, una clave que no es texto o un body que no es objeto no se cuentan", () => {
    expect(comandleEvent({ event: "visit", key: "-" })).toBeNull();
    expect(comandleEvent({ event: "toString", key: "-" })).toBeNull();
    expect(comandleEvent({ key: "-" })).toBeNull();
    expect(comandleEvent({ event: "start" })).toBeNull();
    expect(comandleEvent({ event: "finish", key: 3 })).toBeNull();
    expect(comandleEvent({ event: "ref", key: null })).toBeNull();
    expect(comandleEvent(null)).toBeNull();
    expect(comandleEvent("start")).toBeNull();
    expect(comandleEvent([{ event: "start", key: "-" }])).toBeNull();
  });

  it("los campos que sobran se ignoran: solo se guarda el par", () => {
    expect(comandleEvent({ event: "start", key: "-", id: "jugador-42" })).toEqual({ event: "start", key: "-" });
  });
});

describe("body con tope", () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/comandle", { method: "POST", body, headers });

  it("lee el texto tal cual hasta el tope", async () => {
    expect(await readCappedText(req('{"event":"start","key":"-"}'))).toBe('{"event":"start","key":"-"}');
    expect(await readCappedText(req("a".repeat(MAX_BODY_BYTES)))).toHaveLength(MAX_BODY_BYTES);
  });

  it("corta si pasa del tope, leyendo o declarado", async () => {
    expect(await readCappedText(req("a".repeat(MAX_BODY_BYTES + 1)))).toBeNull();
    // Cuenta bytes, no caracteres
    expect(await readCappedText(req("ñ".repeat(MAX_BODY_BYTES / 2 + 1)))).toBeNull();
    expect(await readCappedText(req("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).toBeNull();
  });

  it("sin body es texto vacío", async () => {
    expect(await readCappedText(new Request("http://localhost/api/comandle", { method: "POST" }))).toBe("");
  });
});

describe("comandle_daily", () => {
  it("la migración crea la tabla y el mismo evento y clave suman en la misma fila", async () => {
    const db = await freshDb();
    const bump = (event: string, key: string) =>
      db
        .insert(comandleDaily)
        .values({ day: "2026-10-21", event, key, count: 1 })
        .onConflictDoUpdate({
          target: [comandleDaily.day, comandleDaily.event, comandleDaily.key],
          set: { count: sql`${comandleDaily.count} + 1` },
        });
    await bump("finish", "3");
    await bump("finish", "3");
    await bump("finish", "x");
    const rows = await db.select().from(comandleDaily).orderBy(comandleDaily.key);
    expect(rows).toEqual([
      { day: "2026-10-21", event: "finish", key: "3", count: 2 },
      { day: "2026-10-21", event: "finish", key: "x", count: 1 },
    ]);
  });
});

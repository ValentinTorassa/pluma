import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { comandleDaily } from "@/db/schema";
import { MAX_BODY_BYTES, comandleEvent, readCappedText, referrerHost } from "@/lib/comandle-event";

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

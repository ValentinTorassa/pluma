import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { comandleDaily, comandleHourly, comandleRooms } from "@/db/schema";
import type { RoomKey } from "./comandle-event";

// Public launch; the earlier rows are development smoke tests.
const PUBLIC_SINCE = "2026-10-28";
const RESULTS = ["1", "2", "3", "4", "5", "6", "x"];

/** Only completed-game aggregates are public. Never return refs or raw rows. */
export async function readComandleSummary(today: string, timeZone: string, now = new Date()) {
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      key: comandleDaily.key,
      total: sql<number>`coalesce(sum(${comandleDaily.count}), 0)`,
      today: sql<number>`coalesce(sum(case when ${comandleDaily.day} = ${today} then ${comandleDaily.count} else 0 end), 0)`,
      yesterday: sql<number>`coalesce(sum(case when ${comandleDaily.day} = ${yesterday} then ${comandleDaily.count} else 0 end), 0)`,
    })
    .from(comandleDaily)
    .where(and(
      eq(comandleDaily.event, "finish"),
      gte(comandleDaily.day, PUBLIC_SINCE),
      lte(comandleDaily.day, today),
      inArray(comandleDaily.key, RESULTS),
    ))
    .groupBy(comandleDaily.key);
  const period = (date: string, field: "today" | "yesterday") => {
    const results = Object.fromEntries(RESULTS.map((key) => [key, 0]));
    for (const row of rows) results[row.key] = Number(row[field]);
    return { date, played: Object.values(results).reduce((n, count) => n + count, 0), results };
  };
  return {
    since: PUBLIC_SINCE,
    timeZone,
    updatedAt: now.toISOString(),
    total: rows.reduce((n, row) => n + Number(row.total), 0),
    today: period(today, "today"),
    yesterday: period(yesterday, "yesterday"),
  };
}

/**
 * Lo que la pantalla del presentador muestra de una sala hoy: cuántos
 * empezaron, cuántos terminaron y en cuántos intentos. `played` es la suma de
 * los resultados; `started` puede quedar por debajo si se perdió algún aviso
 * de inicio. Solo lee `comandle_rooms` de ese día y esa sala; si la tabla no
 * existe tira, y el route handler responde 503 en vez de ceros.
 */
export async function readRoomSummary(today: string, room: string, timeZone: string, now = new Date()) {
  const rows = await db
    .select({ key: comandleRooms.key, count: comandleRooms.count })
    .from(comandleRooms)
    .where(and(eq(comandleRooms.day, today), eq(comandleRooms.room, room)));
  const results = Object.fromEntries(RESULTS.map((key) => [key, 0]));
  let started = 0;
  for (const row of rows) {
    if (row.key === "start") started = Number(row.count);
    else if (RESULTS.includes(row.key)) results[row.key] = Number(row.count);
  }
  return {
    sala: room,
    date: today,
    timeZone,
    updatedAt: now.toISOString(),
    started,
    played: Object.values(results).reduce((n, count) => n + count, 0),
    results,
  };
}

/**
 * Suma 1 al contador del día para ese evento y clave, y otro en su hora
 * (`comandle_hourly`). Devuelve si quedó registrado en el del día y no propaga
 * el error, como `recordSignup`: el deploy puede llegar antes que la migración
 * (0007 o 0011), y una métrica no tiene que responder error. Las dos sumas van
 * por separado: si falta la tabla por hora, el total del día cuenta igual.
 */
export async function recordComandleEvent(day: string, hour: string, event: string, key: string): Promise<boolean> {
  const [daily] = await Promise.all([
    counted("el evento", () =>
      db
        .insert(comandleDaily)
        .values({ day, event, key, count: 1 })
        .onConflictDoUpdate({
          target: [comandleDaily.day, comandleDaily.event, comandleDaily.key],
          set: { count: sql`${comandleDaily.count} + 1` },
        }),
    ),
    counted("la hora del evento", () =>
      db
        .insert(comandleHourly)
        .values({ day, hour, event, key, count: 1 })
        .onConflictDoUpdate({
          target: [comandleHourly.day, comandleHourly.hour, comandleHourly.event, comandleHourly.key],
          set: { count: sql`${comandleHourly.count} + 1` },
        }),
    ),
  ]);
  return daily;
}

/**
 * Suma 1 a la sala en `comandle_rooms` (día, sala y `start` o resultado), y
 * aparte un `sala` sin código en el día y la hora (`start` o `finish`), para
 * ver cuánto se juega en modo clase sin abrir una clave por sala en
 * `comandle_daily`. Devuelve si quedó registrado en la sala. Tampoco propaga el
 * error: si falta la 0012, la sala no cuenta, queda en el log y el día suma
 * igual.
 */
export async function recordRoomEvent(day: string, hour: string, room: string, what: RoomKey): Promise<boolean> {
  const [inRoom] = await Promise.all([
    counted("la sala", () =>
      db
        .insert(comandleRooms)
        .values({ day, room, key: what, count: 1 })
        .onConflictDoUpdate({
          target: [comandleRooms.day, comandleRooms.room, comandleRooms.key],
          set: { count: sql`${comandleRooms.count} + 1` },
        }),
    ),
    recordComandleEvent(day, hour, "sala", what === "start" ? "start" : "finish"),
  ]);
  return inRoom;
}

async function counted(what: string, write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (err) {
    console.error(`[pluma] no se pudo contar ${what} de comandle, sigue de largo:`, err);
    return false;
  }
}

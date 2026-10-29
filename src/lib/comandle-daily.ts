import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { comandleDaily } from "@/db/schema";

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
 * Suma 1 al contador del día para ese evento y clave. Devuelve si quedó
 * registrado y no propaga el error, como `recordSignup`: el deploy puede llegar
 * antes que la migración 0007, y una métrica no tiene que responder error.
 */
export async function recordComandleEvent(day: string, event: string, key: string): Promise<boolean> {
  try {
    await db
      .insert(comandleDaily)
      .values({ day, event, key, count: 1 })
      .onConflictDoUpdate({
        target: [comandleDaily.day, comandleDaily.event, comandleDaily.key],
        set: { count: sql`${comandleDaily.count} + 1` },
      });
    return true;
  } catch (err) {
    console.error("[pluma] no se pudo contar el evento de comandle, sigue de largo:", err);
    return false;
  }
}

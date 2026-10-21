import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { comandleDaily } from "@/db/schema";

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

import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSignups } from "@/db/schema";

/**
 * Suma un alta al contador del día para ese origen y formulario. Devuelve si
 * quedó registrada y no propaga el error, como `recordPageView`: el deploy
 * puede llegar antes que la migración 0006, y un alta que listmonk ya aceptó
 * no tiene que responder error por una métrica.
 */
export async function recordSignup(day: string, ref: string, form: string): Promise<boolean> {
  try {
    await db
      .insert(newsletterSignups)
      .values({ day, ref, form, count: 1 })
      .onConflictDoUpdate({
        target: [newsletterSignups.day, newsletterSignups.ref, newsletterSignups.form],
        set: { count: sql`${newsletterSignups.count} + 1` },
      });
    return true;
  } catch (err) {
    console.error("[pluma] no se pudo contar el origen del alta, sigue de largo:", err);
    return false;
  }
}

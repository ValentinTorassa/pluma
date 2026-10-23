import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cspReports } from "@/db/schema";
import { MAX_CSP_ROWS, type CspViolation } from "./csp-report";

/**
 * Suma `n` a la fila de esa violación, o la crea si todavía hay lugar en la
 * tabla (`MAX_CSP_ROWS`). Primero el UPDATE por clave primaria, que es lo que
 * pasa casi siempre y lee una sola fila; el conteo de la tabla se paga solo
 * cuando aparece una combinación nueva. Devuelve si se registró, y no propaga
 * el error, como `recordSignup`: el deploy puede llegar antes que la migración
 * 0008, y a un navegador que reporta no hay nada que contestarle.
 */
export async function recordCspViolation(v: CspViolation, n: number, now = new Date()): Promise<boolean> {
  try {
    const updated = await db
      .update(cspReports)
      .set({ count: sql`${cspReports.count} + ${n}`, lastSeen: now })
      .where(
        and(
          eq(cspReports.directive, v.directive),
          eq(cspReports.blocked, v.blocked),
          eq(cspReports.path, v.path),
          eq(cspReports.disposition, v.disposition),
        ),
      );
    if (updated.rowsAffected > 0) return true;

    // INSERT … SELECT … WHERE: solo si la tabla no está llena. Si otro pedido
    // creó la misma fila entre el UPDATE y acá, el ON CONFLICT la suma igual.
    const ms = now.getTime();
    const inserted = await db.run(sql`
      INSERT INTO csp_reports (directive, blocked, path, disposition, count, first_seen, last_seen)
      SELECT ${v.directive}, ${v.blocked}, ${v.path}, ${v.disposition}, ${n}, ${ms}, ${ms}
      WHERE (SELECT count(*) FROM csp_reports) < ${MAX_CSP_ROWS}
      ON CONFLICT (directive, blocked, path, disposition)
      DO UPDATE SET count = count + excluded.count, last_seen = excluded.last_seen`);
    return inserted.rowsAffected > 0;
  } catch (err) {
    console.error("[pluma] no se pudo guardar el reporte de CSP, sigue de largo:", err);
    return false;
  }
}

export type CspReportRow = typeof cspReports.$inferSelect;

/**
 * Para el admin: todas las filas (son pocas, la tabla tiene tope), la más
 * reciente primero. `null` si la tabla no existe (falta la migración 0008),
 * para que el panel lo diga en vez de mostrar una lista vacía que parece "sin
 * violaciones".
 */
export async function getCspReports(): Promise<CspReportRow[] | null> {
  try {
    return await db.select().from(cspReports).orderBy(desc(cspReports.lastSeen)).limit(MAX_CSP_ROWS);
  } catch (err) {
    console.error("[pluma] no se pudo leer csp_reports:", err);
    return null;
  }
}

export async function deleteCspReports(): Promise<void> {
  await db.delete(cspReports);
}

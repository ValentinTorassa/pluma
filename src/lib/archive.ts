/**
 * Año y mes (1-12) de una fecha en la zona horaria del sitio.
 * Vercel corre en UTC: un artículo publicado el 31 a las 22:00 en Argentina
 * es el 1 a la 01:00 UTC, y sin esto caería en el mes siguiente.
 */
export function yearMonthInTimeZone(date: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const get = (type: "year" | "month") => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

/** Agrupa fechas por mes (en la zona del sitio), de más nuevo a más viejo */
export function groupByMonth(
  dates: (Date | null)[],
  timeZone: string,
): { year: number; month: number; count: number }[] {
  const map = new Map<string, { year: number; month: number; count: number }>();
  for (const d of dates) {
    if (!d) continue;
    const { year, month } = yearMonthInTimeZone(d, timeZone);
    const key = `${year}-${month}`;
    map.set(key, { year, month, count: (map.get(key)?.count ?? 0) + 1 });
  }
  return [...map.values()].sort((a, b) =>
    a.year === b.year ? b.month - a.month : b.year - a.year,
  );
}

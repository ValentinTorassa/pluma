import { config } from "../config";

type Part = Intl.DateTimeFormatPart["type"];

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  const list = new Intl.DateTimeFormat(config.locale, { timeZone: config.timeZone, ...options }).formatToParts(date);
  return (type: Part) => list.find((p) => p.type === type)?.value ?? "";
}

/** Mes abreviado como en la maqueta: "sep", no "sept." */
const shortMonth = (month: string) => month.replace(/\./g, "").slice(0, 3);

/** "9 sep 2026" */
export function shortDate(date: Date): string {
  const p = parts(date, { day: "numeric", month: "short", year: "numeric" });
  return `${p("day")} ${shortMonth(p("month"))} ${p("year")}`;
}

/** "16 sep" */
export function dayMonth(date: Date): string {
  const p = parts(date, { day: "numeric", month: "short" });
  return `${p("day")} ${shortMonth(p("month"))}`;
}

/** "2026-09-09" en la zona horaria del sitio (atributo datetime) */
export function isoDate(date: Date): string {
  const p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p("year")}-${p("month")}-${p("day")}`;
}

/** "2026-09-16" → Date al mediodía UTC (sin saltos de día por zona horaria) */
export function fromIsoDay(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

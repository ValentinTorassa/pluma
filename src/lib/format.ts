import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import type { Plural } from "@/tenants/types";

/** Elige singular o plural según la cantidad */
export function plural(count: number, forms: Plural): string {
  return count === 1 ? forms.one : forms.other;
}

/** Tiempo relativo corto: "hace 3 h", "hace 2 días", "hace 1 mes". */
export function relativeTime(date: Date, now = new Date()): string {
  const t = messages.relativeTime;
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  if (sec < 60) return t.justNow;
  if (min < 60) return `${t.ago} ${min} ${t.min}`;
  if (hr < 24) return `${t.ago} ${hr} ${t.hours}`;
  if (day < 30) return `${t.ago} ${day} ${plural(day, t.days)}`;
  if (month < 12) return `${t.ago} ${month} ${plural(month, t.months)}`;
  return new Intl.DateTimeFormat(config.locale, { dateStyle: "long" }).format(date);
}

/** "Mayo de 2024": nombre del mes para el archivo (mayúscula inicial) */
export function monthLabel(year: number, month: number): string {
  const raw = new Intl.DateTimeFormat(config.locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

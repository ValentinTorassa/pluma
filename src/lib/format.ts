/** Tiempo relativo corto: "hace 3 h", "hace 2 días", "hace 1 mes". */
export function relativeTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  if (sec < 60) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  if (hr < 24) return `hace ${hr} h`;
  if (day < 30) return `hace ${day} ${day === 1 ? "día" : "días"}`;
  if (month < 12) return `hace ${month} ${month === 1 ? "mes" : "meses"}`;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(date);
}

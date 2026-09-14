import { describe, expect, it } from "vitest";
import { groupByMonth, yearMonthInTimeZone } from "@/lib/archive";

const AR = "America/Argentina/Buenos_Aires";

describe("archivo por mes (zona del sitio)", () => {
  it("un artículo del 31/08 22:00 en Argentina queda en agosto aunque en UTC sea septiembre", () => {
    const d = new Date("2026-09-01T01:00:00Z"); // 31/08 22:00 ART (UTC-3)
    expect(yearMonthInTimeZone(d, "UTC")).toEqual({ year: 2026, month: 9 });
    expect(yearMonthInTimeZone(d, AR)).toEqual({ year: 2026, month: 8 });
  });

  it("cruce de año", () => {
    expect(yearMonthInTimeZone(new Date("2027-01-01T02:59:00Z"), AR)).toEqual({ year: 2026, month: 12 });
    expect(yearMonthInTimeZone(new Date("2027-01-01T03:00:00Z"), AR)).toEqual({ year: 2027, month: 1 });
  });

  it("las fechas actuales de producción no cambian de mes", () => {
    // 17 artículos el 26/08/2026 ~17:37 UTC y 1 el 09/09/2026
    const dates = [
      ...Array.from({ length: 17 }, () => new Date("2026-08-26T17:37:42Z")),
      new Date("2026-09-09T15:00:00Z"),
      null,
    ];
    expect(groupByMonth(dates, AR)).toEqual(groupByMonth(dates, "UTC"));
    expect(groupByMonth(dates, AR)).toEqual([
      { year: 2026, month: 9, count: 1 },
      { year: 2026, month: 8, count: 17 },
    ]);
  });
});

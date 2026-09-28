import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { newsletterSignups } from "@/db/schema";
import { signupForm, signupRef } from "@/lib/newsletter-origin";

/** SQLite en memoria con todas las migraciones de drizzle/ aplicadas */
async function freshDb() {
  const client = createClient({ url: ":memory:" });
  const dir = join(__dirname, "..", "..", "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  return drizzle(client, { schema });
}

describe("origen de un alta", () => {
  it("el ref del link pasa tal cual, en minúsculas", () => {
    expect(signupRef("charla-owasp")).toBe("charla-owasp");
    expect(signupRef("Discord")).toBe("discord");
  });

  it("sin ref es directo, y algo raro es otro", () => {
    expect(signupRef(null)).toBe("directo");
    expect(signupRef("")).toBe("directo");
    expect(signupRef("<script>")).toBe("otro");
    expect(signupRef("a".repeat(60))).toBe("otro");
    expect(signupRef(42)).toBe("directo");
  });

  it("el formulario sale del id, y uno desconocido es otro", () => {
    expect(signupForm("nl-q")).toBe("apuntes");
    expect(signupForm("nl-art")).toBe("articulo");
    expect(signupForm("nl-home")).toBe("home");
    expect(signupForm("toString")).toBe("otro");
    expect(signupForm(undefined)).toBe("otro");
  });
});

describe("newsletter_signups", () => {
  it("la migración crea la tabla y el mismo origen suma en la misma fila", async () => {
    const db = await freshDb();
    const alta = () =>
      db
        .insert(newsletterSignups)
        .values({ day: "2026-10-07", ref: "charla-owasp", form: "apuntes", count: 1 })
        .onConflictDoUpdate({
          target: [newsletterSignups.day, newsletterSignups.ref, newsletterSignups.form],
          set: { count: sql`${newsletterSignups.count} + 1` },
        });
    await alta();
    await alta();
    await db.insert(newsletterSignups).values({ day: "2026-10-07", ref: "directo", form: "articulo", count: 1 });
    const rows = await db.select().from(newsletterSignups).orderBy(newsletterSignups.ref);
    expect(rows).toEqual([
      { day: "2026-10-07", ref: "charla-owasp", form: "apuntes", count: 2 },
      { day: "2026-10-07", ref: "directo", form: "articulo", count: 1 },
    ]);
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { pageViewHits, pageViews } from "@/db/schema";
import { PAGE_KEYS, pageKey } from "@/lib/page-key";

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

describe("clave de página", () => {
  it("la home es la home con o sin barra final", () => {
    expect(pageKey("/")).toBe("home");
    expect(pageKey("")).toBe("home");
  });

  it("cuenta las páginas fijas del sitio", () => {
    expect(pageKey("/acerca")).toBe("acerca");
    expect(pageKey("/series")).toBe("series");
    expect(pageKey("/apuntes")).toBe("apuntes");
    expect(pageKey("/archivo")).toBe("archivo");
    expect(pageKey("/buscar")).toBe("buscar");
  });

  it("los hijos suman a su padre", () => {
    expect(pageKey("/apuntes/3")).toBe("apuntes");
    expect(pageKey("/serie/linux-desde-cero")).toBe("series");
    expect(pageKey("/archivo/2026/09")).toBe("archivo");
  });

  it("el artículo no pasa por acá: lo cuenta ViewBeacon con su id", () => {
    expect(pageKey("/articulo/permisos-chmod-777")).toBeNull();
  });

  it("ignora la barra final, el query y el hash", () => {
    expect(pageKey("/acerca/")).toBe("acerca");
    expect(pageKey("/buscar?q=chmod")).toBe("buscar");
    expect(pageKey("/apuntes/3#bloque")).toBe("apuntes");
  });

  it("lo que no está en el conjunto no se cuenta", () => {
    for (const path of ["/admin", "/admin/articulos", "/acerca/otra", "/apuntes/3/4", "/azar", "/inventada"]) {
      expect(pageKey(path)).toBeNull();
    }
  });

  it("un 404 dentro de una rama no cuenta: solo las formas que existen", () => {
    expect(pageKey("/serie")).toBeNull();
    expect(pageKey("/archivo/2026")).toBeNull();
    expect(pageKey("/buscar/algo")).toBeNull();
  });

  it("toda clave devuelta está en PAGE_KEYS", () => {
    const keys = ["/", "/acerca", "/series", "/serie/x", "/apuntes", "/apuntes/1", "/archivo", "/archivo/2026/09", "/buscar"]
      .map(pageKey)
      .filter((k) => k !== null);
    expect(keys).toHaveLength(9);
    for (const k of keys) expect(PAGE_KEYS).toContain(k);
  });
});

describe("dedupe por día (migración 0005)", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("el mismo visitante en la misma página y día entra una sola vez", async () => {
    const row = { page: "home", day: "2026-09-21", ipHash: "hash-a" };
    const first = await db.insert(pageViewHits).values(row).onConflictDoNothing().returning({ page: pageViewHits.page });
    const second = await db.insert(pageViewHits).values(row).onConflictDoNothing().returning({ page: pageViewHits.page });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it("separa por página, por día y por visitante", async () => {
    await db.insert(pageViewHits).values([
      { page: "home", day: "2026-09-21", ipHash: "hash-a" },
      { page: "home", day: "2026-09-21", ipHash: "hash-b" },
      { page: "home", day: "2026-09-22", ipHash: "hash-a" },
      { page: "apuntes", day: "2026-09-21", ipHash: "hash-a" },
    ]);
    expect(await db.select().from(pageViewHits)).toHaveLength(4);
  });

  it("el agregado suma la visita siempre y el único solo si es nuevo", async () => {
    // El mismo upsert que hace recordPageView: views +1 siempre, uniques +isUnique
    const bump = (isUnique: number) =>
      db
        .insert(pageViews)
        .values({ page: "home", day: "2026-09-21", views: 1, uniques: isUnique })
        .onConflictDoUpdate({
          target: [pageViews.page, pageViews.day],
          set: {
            views: sql`${pageViews.views} + 1`,
            uniques: sql`${pageViews.uniques} + ${isUnique}`,
          },
        });

    await bump(1); // visitante nuevo
    await bump(0); // el mismo, otra vez
    await bump(1); // otro visitante

    const [row] = await db.select().from(pageViews);
    expect(row).toEqual({ page: "home", day: "2026-09-21", views: 3, uniques: 2 });
  });
});

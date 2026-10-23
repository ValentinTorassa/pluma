import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/csp-report de punta a punta, sin Turso: la base es una SQLite en
 * memoria con las migraciones, como en comandle-route.test.ts.
 */
const features = vi.hoisted(() => ({ cspReports: true }));
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({ config: { features } }));
vi.mock("@/db", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/db/schema");
  const client = createClient({ url: ":memory:" });
  const dir = join(__dirname, "..", "..", "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  return { db: drizzle(client, { schema }) };
});

const { POST } = await import("@/feature-routes/api/csp-report/route");
const { db } = await import("@/db");
const { cspReports } = await import("@/db/schema");
const { MAX_CSP_ROWS, MAX_REPORT_BYTES } = await import("@/lib/csp-report");

const URI = "application/csp-report";
const API = "application/reports+json";

function post(body: unknown, contentType = URI) {
  return POST(
    new NextRequest("https://vtsecurity.com.ar/api/csp-report", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function uriReport(path = "/articulo/x", blocked = "inline") {
  return {
    "csp-report": {
      "document-uri": `https://vtsecurity.com.ar${path}?utm=1`,
      "effective-directive": "script-src-elem",
      "violated-directive": "script-src-elem",
      "blocked-uri": blocked,
      disposition: "report",
      "original-policy": "default-src 'self'",
    },
  };
}

async function rows() {
  return db.select().from(cspReports);
}

beforeEach(async () => {
  await db.delete(cspReports);
});

afterEach(() => {
  features.cspReports = true;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/csp-report", () => {
  it("un reporte válido de report-uri queda como una fila agregada, sin la URL completa", async () => {
    const res = await post(uriReport("/articulo/x", "https://evil.example/a.js?k=secret"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const [row, ...rest] = await rows();
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      directive: "script-src-elem",
      blocked: "https://evil.example",
      path: "/articulo/x",
      disposition: "report",
      count: 1,
    });
    expect(row?.firstSeen).toEqual(row?.lastSeen);
  });

  it("la Reporting API: un array con varias violaciones, agregadas en el mismo pedido", async () => {
    const one = {
      type: "csp-violation",
      url: "https://vtsecurity.com.ar/",
      body: { documentURL: "https://vtsecurity.com.ar/", blockedURL: "inline", effectiveDirective: "script-src-elem", disposition: "enforce" },
    };
    const res = await post([one, one, { ...one, body: { ...one.body, blockedURL: "eval", effectiveDirective: "script-src" } }], API);
    expect(res.status).toBe(204);
    const all = await rows();
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.blocked === "inline")?.count).toBe(2);
    expect(all.find((r) => r.blocked === "eval")?.count).toBe(1);
  });

  it("deduplica: la misma violación suma en su fila y actualiza la última vez", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    await post(uriReport());
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    await post(uriReport());
    await post(uriReport());
    await post(uriReport("/series"));
    const all = await rows();
    expect(all).toHaveLength(2);
    const row = all.find((r) => r.path === "/articulo/x");
    expect(row?.count).toBe(3);
    expect(row?.firstSeen.toISOString()).toBe("2026-10-23T10:00:00.000Z");
    expect(row?.lastSeen.toISOString()).toBe("2026-10-24T12:00:00.000Z");
  });

  it("otro Content-Type es 415 y no guarda nada", async () => {
    for (const type of ["application/json", "text/plain;charset=UTF-8", "application/x-www-form-urlencoded"]) {
      expect((await post(uriReport(), type)).status, type).toBe(415);
    }
    expect(await rows()).toEqual([]);
  });

  it("un body de más de 16 KB es 413 aunque sea un reporte válido", async () => {
    const big = uriReport();
    big["csp-report"]["original-policy"] = "a".repeat(MAX_REPORT_BYTES);
    expect((await post(big)).status).toBe(413);
    expect(await rows()).toEqual([]);
  });

  it("JSON roto o con otra forma es 400; un reporte inválido se descarta con 204", async () => {
    for (const body of ["", "no es json", '{"csp-report":', "null", "[]", JSON.stringify({ otra: "cosa" })]) {
      expect((await post(body)).status, body).toBe(400);
    }
    expect((await post(uriReport(), API)).status).toBe(400);
    const sinDirectiva = { "csp-report": { "document-uri": "https://vtsecurity.com.ar/", "blocked-uri": "inline" } };
    expect((await post(sinDirectiva)).status).toBe(204);
    expect(await rows()).toEqual([]);
  });

  it("con la tabla llena descarta combinaciones nuevas pero sigue contando las que existen", async () => {
    const now = Date.now();
    const values = Array.from({ length: MAX_CSP_ROWS }, (_, i) => ({
      directive: "script-src-elem",
      blocked: "inline",
      path: `/relleno/${i}`,
      disposition: "report",
      count: 1,
      firstSeen: new Date(now),
      lastSeen: new Date(now),
    }));
    for (let i = 0; i < values.length; i += 100) await db.insert(cspReports).values(values.slice(i, i + 100));

    expect((await post(uriReport("/nueva"))).status).toBe(204);
    expect((await post(uriReport("/relleno/7"))).status).toBe(204);
    const all = await rows();
    expect(all).toHaveLength(MAX_CSP_ROWS);
    expect(all.some((r) => r.path === "/nueva")).toBe(false);
    expect(all.find((r) => r.path === "/relleno/7")?.count).toBe(2);
  });

  it("sin la tabla (deploy antes que la migración) responde 204 igual y lo registra en el log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.run(sql`DROP TABLE csp_reports`);
    try {
      expect((await post(uriReport())).status).toBe(204);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      await db.run(sql`CREATE TABLE csp_reports (directive text NOT NULL, blocked text NOT NULL, path text NOT NULL,
        disposition text NOT NULL, count integer DEFAULT 0 NOT NULL, first_seen integer NOT NULL, last_seen integer NOT NULL,
        PRIMARY KEY(directive, blocked, path, disposition))`);
    }
  });

  it("con la feature apagada es 404", async () => {
    features.cspReports = false;
    await expect(post(uriReport())).rejects.toThrow();
  });
});

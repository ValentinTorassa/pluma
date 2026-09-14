import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  API_SCOPES,
  authenticateToken,
  bearerToken,
  generateToken,
  hashToken,
  hasScope,
  isWellFormedToken,
  parseScopes,
} from "@/lib/api-tokens";

const root = join(__dirname, "..", "..");

/** SQLite con todas las migraciones de drizzle/ aplicadas */
async function migrated(url: string) {
  const client = createClient({ url });
  const dir = join(root, "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  return client;
}

describe("tokens: formato y hash", () => {
  it("genera tokens distintos, con prefijo y 32 bytes en base64url", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^pluma_[A-Za-z0-9_-]{43}$/);
    expect(isWellFormedToken(a)).toBe(true);
    expect(isWellFormedToken(`${a}x`)).toBe(false);
    expect(isWellFormedToken("pluma_corto")).toBe(false);
  });

  it("hashToken es SHA-256 en hex", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const token = generateToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token.slice(6));
  });

  it("bearerToken solo acepta `Bearer <token bien formado>`", () => {
    const token = generateToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer ${token}`)).toBe(token);
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken(`Basic ${token}`)).toBeNull();
    expect(bearerToken(`Bearer ${token} extra`)).toBeNull();
    expect(bearerToken("Bearer pluma_x")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("tokens: scopes", () => {
  it("parseScopes ignora desconocidos, repetidos y JSON roto", () => {
    expect(parseScopes('["posts:write","admin","posts:write",3]')).toEqual(["posts:write"]);
    expect(parseScopes("{")).toEqual([]);
    expect(parseScopes('"posts:write"')).toEqual([]);
  });

  it("write y publish incluyen read; ninguno incluye al otro", () => {
    expect(hasScope(["posts:write"], "posts:read")).toBe(true);
    expect(hasScope(["posts:publish"], "posts:read")).toBe(true);
    expect(hasScope(["posts:write"], "posts:publish")).toBe(false);
    expect(hasScope(["posts:publish"], "posts:write")).toBe(false);
    expect(hasScope(["posts:read"], "posts:write")).toBe(false);
    expect(hasScope(["posts:write"], "series:write")).toBe(false);
    expect(hasScope([], "posts:read")).toBe(false);
    expect(hasScope(["posts:*"], "posts:write")).toBe(false);
  });
});

describe("tokens: authenticateToken", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const token = generateToken();

  beforeEach(async () => {
    db = drizzle(await migrated(":memory:"), { schema });
    await db.insert(schema.apiTokens).values({
      id: "t1",
      name: "agente",
      tokenHash: hashToken(token),
      scopes: '["posts:write"]',
    });
  });

  it("acepta un token vigente y anota last_used_at", async () => {
    const now = new Date("2026-09-14T12:00:00Z");
    expect(await authenticateToken(db, token, now)).toEqual({ id: "t1", name: "agente", scopes: ["posts:write"] });
    const [row] = await db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, "t1"));
    expect(row.lastUsedAt).toEqual(now);
  });

  it("rechaza tokens desconocidos, mal formados o revocados", async () => {
    expect(await authenticateToken(db, generateToken())).toBeNull();
    expect(await authenticateToken(db, hashToken(token))).toBeNull();
    await db.update(schema.apiTokens).set({ revokedAt: new Date() }).where(eq(schema.apiTokens.id, "t1"));
    expect(await authenticateToken(db, token)).toBeNull();
  });
});

describe("scripts/create-api-token.mjs", () => {
  const dir = mkdtempSync(join(tmpdir(), "pluma-token-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function run(args: string[], env: Record<string, string>) {
    return spawnSync(process.execPath, ["scripts/create-api-token.mjs", ...args], {
      cwd: root,
      // Entorno mínimo: sin TURSO_AUTH_TOKEN ni nada del shell que corre los tests
      env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
      encoding: "utf8",
    });
  }

  it("se niega a usar una base remota sin --allow-remote", () => {
    const result = run(["--name", "agente"], { TURSO_DATABASE_URL: "libsql://ejemplo.invalid" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--allow-remote");
    expect(result.stdout).toBe("");
  });

  it("rechaza scopes desconocidos", () => {
    const result = run(["--name", "agente", "--scopes", "posts:write,admin"], {
      TURSO_DATABASE_URL: `file:${join(dir, "scopes.db")}`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("admin");
  });

  it("crea un token que la API acepta y guarda solo su hash", async () => {
    const url = `file:${join(dir, "tokens.db")}`;
    const client = await migrated(url);
    const result = run(["--name", "agente", "--scopes", API_SCOPES.join(",")], { TURSO_DATABASE_URL: url });
    expect(result.status, result.stderr).toBe(0);

    const token = result.stdout.trim();
    expect(isWellFormedToken(token)).toBe(true);
    expect(result.stderr).not.toContain(token);

    const db = drizzle(client, { schema });
    const rows = await db.select().from(schema.apiTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token.slice(6));
    expect(await authenticateToken(db, token)).toMatchObject({ name: "agente", scopes: [...API_SCOPES] });
    client.close();
  });
});

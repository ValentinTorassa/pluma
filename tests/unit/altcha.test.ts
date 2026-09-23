import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  ALTCHA_TTL_MS,
  altchaKey,
  createChallenge,
  decodePayload,
  verifySolution,
  type AltchaPayload,
} from "@/lib/altcha";
import { solveChallenge } from "@/lib/altcha-solve";
import { consumeRateLimit } from "@/lib/rate-limit";

const KEY = "clave-de-test";
/** Challenges chicos para que el test no pague la dificultad real */
const SMALL = 500;

async function solved(now = Date.now(), key = KEY) {
  const raw = await solveChallenge(createChallenge(key, now, SMALL));
  expect(raw).not.toBeNull();
  return { raw: raw!, payload: decodePayload(raw)! };
}

describe("altcha", () => {
  it("una solución del navegador verifica en el servidor", async () => {
    const { payload } = await solved();
    expect(verifySolution(payload, KEY)).toBe(true);
  });

  it("rechaza un número adulterado", async () => {
    const { payload } = await solved();
    expect(verifySolution({ ...payload, number: payload.number + 1 }, KEY)).toBe(false);
  });

  it("rechaza un challenge firmado con otra clave", async () => {
    const { payload } = await solved(Date.now(), "otra-clave");
    expect(verifySolution(payload, KEY)).toBe(false);
  });

  it("rechaza un salt cambiado para estirar el vencimiento", async () => {
    const { payload } = await solved();
    const salt = payload.salt.replace(/expires=\d+/, "expires=9999999999");
    expect(verifySolution({ ...payload, salt }, KEY)).toBe(false);
  });

  it("vence a los diez minutos", async () => {
    const now = 1_700_000_000_000;
    const { payload } = await solved(now);
    expect(verifySolution(payload, KEY, now + ALTCHA_TTL_MS - 1000)).toBe(true);
    expect(verifySolution(payload, KEY, now + ALTCHA_TTL_MS)).toBe(false);
  });

  it("rechaza otro algoritmo y firmas que no son hex", async () => {
    const { payload } = await solved();
    expect(verifySolution({ ...payload, algorithm: "SHA-1" }, KEY)).toBe(false);
    const bad: AltchaPayload = { ...payload, signature: "z".repeat(payload.signature.length) };
    expect(verifySolution(bad, KEY)).toBe(false);
  });

  it("decodePayload descarta lo que no tiene la forma esperada", () => {
    for (const raw of [undefined, 42, "", "no-es-base64-json", btoa("{}"), "x".repeat(3000)]) {
      expect(decodePayload(raw)).toBeNull();
    }
    const numberAsString = btoa(
      JSON.stringify({ algorithm: "SHA-256", challenge: "a", number: "1", salt: "s", signature: "b" }),
    );
    expect(decodePayload(numberAsString)).toBeNull();
  });

  it("la clave sale de ALTCHA_HMAC_KEY, si no de IP_SALT, si no no hay", () => {
    expect(altchaKey({ ALTCHA_HMAC_KEY: "k", IP_SALT: "s" })).toBe("k");
    const derived = altchaKey({ IP_SALT: "s" });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toBe("s");
    expect(altchaKey({})).toBeNull();
  });

  it("una solución se gasta al primer uso (como la usa /api/newsletter)", async () => {
    const client = createClient({ url: ":memory:" });
    const dir = join(__dirname, "..", "..", "drizzle");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
        if (stmt.trim()) await client.execute(stmt);
      }
    }
    const db = drizzle(client, { schema });
    const { payload } = await solved();
    const once = { limit: 1, windowMs: ALTCHA_TTL_MS };
    expect((await consumeRateLimit(db, `altcha:${payload.signature}`, once)).allowed).toBe(true);
    expect((await consumeRateLimit(db, `altcha:${payload.signature}`, once)).allowed).toBe(false);
  });
});

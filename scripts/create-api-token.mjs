/**
 * Crea un token para la API de publicación (/api/v1, feature `publicApi`) y lo
 * imprime UNA sola vez por stdout. En la base queda solo su SHA-256.
 *
 *   TURSO_DATABASE_URL=file:/abs/vt.db node scripts/create-api-token.mjs \
 *     --name "agente de borradores" --scopes posts:write
 *
 * Scopes (coma): posts:read, posts:write (borradores), posts:publish (publicar
 * o tocar algo ya publicado), series:write. Por defecto: posts:write.
 *
 * Se niega a correr contra una base que no sea local (`file:` o libsql/http en
 * localhost). Para la base de un deployment real hay que pasar --allow-remote
 * a propósito (usa TURSO_DATABASE_URL y TURSO_AUTH_TOKEN del entorno).
 *
 * Formato, hash y scopes: los mismos que src/lib/api-tokens.ts (el test
 * tests/unit/api-tokens.test.ts verifica que la API acepte lo que crea esto).
 * Revocar: UPDATE api_tokens SET revoked_at = unixepoch() * 1000 WHERE id = '…'.
 */
import { createClient } from "@libsql/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const SCOPES = ["posts:read", "posts:write", "posts:publish", "series:write"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      name: { type: "string" },
      scopes: { type: "string", default: "posts:write" },
      "allow-remote": { type: "boolean", default: false },
    },
  }));
} catch (err) {
  fail(err.message);
}

const name = (args.name ?? "").trim();
if (!name) fail('Missing --name (e.g. --name "drafts agent")');

const scopes = [...new Set(args.scopes.split(",").map((s) => s.trim()).filter(Boolean))];
const unknown = scopes.filter((s) => !SCOPES.includes(s));
if (scopes.length === 0 || unknown.length > 0) {
  fail(`Invalid scopes: ${unknown.join(", ") || "(none)"}. Options: ${SCOPES.join(", ")}`);
}

const url = process.env.TURSO_DATABASE_URL ?? "";

function isLocal(value) {
  if (value.startsWith("file:")) return true;
  try {
    const { protocol, hostname } = new URL(value);
    return (
      ["libsql:", "http:", "https:", "ws:", "wss:"].includes(protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    );
  } catch {
    return false;
  }
}

if (!url) fail("Missing TURSO_DATABASE_URL.");
if (!isLocal(url) && !args["allow-remote"]) {
  fail(
    `Refusing to run: TURSO_DATABASE_URL is not local (got "${url.split(":")[0]}:..."). ` +
      "Pass --allow-remote on purpose to create a token in a remote database.",
  );
}

const token = `pluma_${randomBytes(32).toString("base64url")}`;
const id = randomUUID();
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await client.execute({
    sql: "INSERT INTO api_tokens (id, name, token_hash, scopes, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, name, createHash("sha256").update(token, "utf8").digest("hex"), JSON.stringify(scopes), Date.now()],
  });
} catch (err) {
  fail(/no such table/i.test(String(err)) ? "Table api_tokens is missing: apply drizzle/0003_api_tokens.sql first." : String(err));
} finally {
  client.close();
}

console.error(`Created API token "${name}" (id ${id}, scopes: ${scopes.join(", ")}).`);
console.error("Copy it now: it is not shown again and only its SHA-256 is stored.");
console.log(token);

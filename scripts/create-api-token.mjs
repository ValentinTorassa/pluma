/**
 * Tokens de la API de publicación (/api/v1, feature `publicApi`).
 *
 *   # crear: imprime el token UNA sola vez por stdout; en la base queda solo su SHA-256
 *   TURSO_DATABASE_URL=file:/abs/vt.db node scripts/create-api-token.mjs \
 *     --name "agente de borradores" --scopes posts:write
 *
 *   # listar (id, nombre, scopes, fechas; nunca el token ni el hash)
 *   TURSO_DATABASE_URL=file:/abs/vt.db node scripts/create-api-token.mjs --list
 *
 *   # revocar: el token deja de valer al instante (la fila queda como registro)
 *   TURSO_DATABASE_URL=file:/abs/vt.db node scripts/create-api-token.mjs --revoke <id>
 *
 * Scopes (coma): posts:read, posts:write (borradores), posts:publish (publicar
 * o tocar algo ya publicado), series:write. Por defecto: posts:write.
 *
 * En los tres modos se niega a usar una base que no sea local (`file:` o
 * libsql/http en localhost). Para la base de un deployment real hay que pasar
 * --allow-remote a propósito (usa TURSO_DATABASE_URL y TURSO_AUTH_TOKEN).
 *
 * Formato, hash y scopes: los mismos que src/lib/api-tokens.ts (el test
 * tests/unit/api-tokens.test.ts verifica que la API acepte lo que crea esto).
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
      scopes: { type: "string" },
      list: { type: "boolean", default: false },
      revoke: { type: "string" },
      "allow-remote": { type: "boolean", default: false },
    },
  }));
} catch (err) {
  fail(err.message);
}

const modes = [args.name !== undefined, args.list, args.revoke !== undefined].filter(Boolean).length;
if (modes !== 1) {
  fail('Use exactly one of: --name "…" [--scopes …], --list, --revoke <id>');
}
if (args.scopes !== undefined && args.name === undefined) fail("--scopes only applies when creating (--name).");

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
      "Pass --allow-remote on purpose to use a remote database.",
  );
}

function missingTable(err) {
  return /no such table/i.test(String(err))
    ? "Table api_tokens is missing: apply drizzle/0003_api_tokens.sql first."
    : String(err);
}

const iso = (ms) => (ms == null ? "-" : new Date(Number(ms)).toISOString());

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  if (args.list) {
    const { rows } = await client.execute(
      "SELECT id, name, scopes, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at",
    );
    if (rows.length === 0) console.error("No API tokens.");
    for (const r of rows) {
      const scopes = (() => {
        try {
          return JSON.parse(String(r.scopes)).join(",");
        } catch {
          return String(r.scopes);
        }
      })();
      console.log(
        [
          r.id,
          r.name,
          scopes,
          `created ${iso(r.created_at)}`,
          `last used ${iso(r.last_used_at)}`,
          r.revoked_at == null ? "active" : `revoked ${iso(r.revoked_at)}`,
        ].join("\t"),
      );
    }
  } else if (args.revoke !== undefined) {
    const id = args.revoke.trim();
    if (!id) fail("Missing token id for --revoke (see --list).");
    const { rows } = await client.execute({ sql: "SELECT revoked_at FROM api_tokens WHERE id = ?", args: [id] });
    if (rows.length === 0) fail(`No API token with id ${id}.`);
    if (rows[0].revoked_at != null) {
      console.error(`Token ${id} was already revoked (${iso(rows[0].revoked_at)}).`);
    } else {
      await client.execute({
        sql: "UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
        args: [Date.now(), id],
      });
      console.error(`Revoked API token ${id}.`);
    }
  } else {
    const name = args.name.trim();
    if (!name) fail('Missing --name (e.g. --name "drafts agent")');

    const scopes = [...new Set((args.scopes ?? "posts:write").split(",").map((s) => s.trim()).filter(Boolean))];
    const unknown = scopes.filter((s) => !SCOPES.includes(s));
    if (scopes.length === 0 || unknown.length > 0) {
      fail(`Invalid scopes: ${unknown.join(", ") || "(none)"}. Options: ${SCOPES.join(", ")}`);
    }

    const token = `pluma_${randomBytes(32).toString("base64url")}`;
    const id = randomUUID();
    await client.execute({
      sql: "INSERT INTO api_tokens (id, name, token_hash, scopes, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [id, name, createHash("sha256").update(token, "utf8").digest("hex"), JSON.stringify(scopes), Date.now()],
    });
    console.error(`Created API token "${name}" (id ${id}, scopes: ${scopes.join(", ")}).`);
    console.error("Copy it now: it is not shown again and only its SHA-256 is stored.");
    console.log(token);
  }
} catch (err) {
  fail(missingTable(err));
} finally {
  client.close();
}

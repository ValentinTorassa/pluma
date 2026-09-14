/**
 * Crea una base SQLite LOCAL aplicando las migraciones de drizzle/ en orden.
 * Uso (CI): TURSO_DATABASE_URL=file:ci.db node scripts/create-local-db.mjs
 *
 * Se niega a correr contra cualquier URL que no sea `file:` — nunca toca Turso.
 */
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error(`Refusing to run: TURSO_DATABASE_URL must be a local file: URL (got "${url.split(":")[0]}:...")`);
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = createClient({ url });

for (const file of files) {
  const statements = readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint");
  for (const statement of statements) {
    if (statement.trim()) await client.execute(statement);
  }
  console.log(`applied ${file}`);
}

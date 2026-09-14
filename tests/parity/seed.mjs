/**
 * Crea una SQLite LOCAL con contenido fijo para comparar dos builds
 * (p. ej. la rama base vs. una refactorización) página por página.
 *
 * Uso: TURSO_DATABASE_URL=file:/abs/parity.db node tests/parity/seed.mjs
 *
 * Aplica drizzle/ (igual que scripts/create-local-db.mjs) y carga artículos,
 * comentarios, votos y settings con fechas viejas (2024) para que los tiempos
 * relativos se rendericen como fecha absoluta y no cambien entre corridas.
 * Se niega a correr contra cualquier URL que no sea `file:`.
 */
import { createClient } from "@libsql/client";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error("Refusing to run: TURSO_DATABASE_URL must be a local file: URL");
  process.exit(1);
}
const path = url.slice("file:".length);
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  if (existsSync(path + suffix)) rmSync(path + suffix);
}

const client = createClient({ url });
const dir = join(import.meta.dirname, "..", "..", "drizzle");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) await client.execute(statement);
  }
}

const day = (iso) => new Date(iso).getTime();

const body = `## ¿Qué es una pericia psicológica penal?

La **pericia psicológica penal** es una evaluación técnica realizada por un profesional de la psicología en el marco de un proceso judicial.

![Etapas del proceso pericial](/images/pericia-proceso.svg)

## Su rol en el sistema judicial santafesino

- Evaluación de la imputabilidad
- Valoración del daño psíquico en víctimas
- Orientación técnica en causas de violencia familiar

> La pericia no reemplaza la decisión judicial: la ilumina con conocimiento científico.

## Consideraciones éticas

El perito psicólogo debe mantener la *imparcialidad* y el [secreto profesional](https://example.com).`;

const articles = [
  ["a1", "el-rol-de-la-pericia", "El rol de la pericia psicológica penal", "Cómo las pericias aportan evidencia en los procesos penales.", body, "/images/pericia-cover.svg", '["pericias","santa-fe"]', "published", "2024-05-20T15:00:00Z"],
  ["a2", "camara-gesell", "Cámara Gesell: qué es y cómo funciona", "Una herramienta para escuchar a niñas, niños y adolescentes.", "## Uno\n\nTexto.\n\n## Dos\n\nMás texto.", "/images/cover-gesell.svg", '["pericias","infancias"]', "published", "2024-04-02T12:00:00Z"],
  ["a3", "sin-portada", "Un artículo sin portada", "", "Contenido breve sin encabezados.", null, '["salud-mental"]', "published", "2024-01-31T23:30:00Z"],
  ["a4", "borrador", "Un borrador", "", "No se publica.", null, "[]", "draft", null],
];
for (const [id, slug, title, excerpt, content, cover, tags, status, publishedAt] of articles) {
  const ts = publishedAt ? day(publishedAt) : day("2024-06-01T00:00:00Z");
  await client.execute({
    sql: `INSERT INTO articles (id, slug, title, excerpt, content, cover_image, tags, status, published_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, slug, title, excerpt, content, cover, tags, status, publishedAt ? ts : null, ts, ts],
  });
}

const comments = [
  ["c1", "a1", null, "Lucía", "Muy claro, gracias.", "approved", "2024-05-21T10:00:00Z"],
  ["c2", "a1", "c1", "Yanina", "¡Gracias a vos!", "approved", "2024-05-21T11:00:00Z"],
  ["c3", "a1", null, "Spam", "pendiente", "pending", "2024-05-22T11:00:00Z"],
];
for (const [id, articleId, parentId, username, content, status, at] of comments) {
  await client.execute({
    sql: `INSERT INTO comments (id, article_id, parent_id, username, content, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?, 'x', ?, ?)`,
    args: [id, articleId, parentId, username, content, status, day(at)],
  });
}

for (const [id, articleId] of [["u1", "a1"], ["u2", "a1"], ["u3", "a2"]]) {
  await client.execute({
    sql: `INSERT INTO upvotes (id, article_id, ip_hash, created_at) VALUES (?, ?, ?, ?)`,
    args: [id, articleId, id, day("2024-05-21T10:00:00Z")],
  });
}

await client.execute({
  sql: `INSERT INTO settings (key, value) VALUES ('author.linkedin', ?), ('author.email', ?)`,
  args: ["https://www.linkedin.com/in/ejemplo", "autora@example.com"],
});

console.log(`seeded ${path}`);

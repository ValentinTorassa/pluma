/**
 * Siembra una SQLite LOCAL con el contenido de ejemplo de la maqueta v3 de
 * VT Security (series, artículos con figuras, envíos de Apuntes y
 * comentarios). Para desarrollo y capturas del tenant vt.
 *
 *   TURSO_DATABASE_URL=file:/abs/vt.db node scripts/seed-vt.mjs
 *   env TURSO_DATABASE_URL=file:/abs/vt.db PLUMA_TENANT=vt … npx next build && npx next start
 *
 * Borra el archivo, aplica drizzle/ en orden y carga los datos. Se niega a
 * correr contra cualquier URL que no sea `file:` (nunca toca Turso).
 * Los textos largos viven en scripts/seed-vt/*.md.
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
const root = join(import.meta.dirname, "..");
const migrations = join(root, "drizzle");
for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
  for (const statement of readFileSync(join(migrations, file), "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) await client.execute(statement);
  }
}

const md = (name) => readFileSync(join(import.meta.dirname, "seed-vt", `${name}.md`), "utf8").trim();
const at = (iso) => new Date(iso).getTime();

/* ---------- series ---------- */

const series = [
  {
    id: "s-linux",
    slug: "linux-desde-cero",
    title: "Linux desde cero",
    summary: "Archivos, permisos, procesos y logs, para dejar de copiar comandos sin saber qué hacen.",
    description:
      "Linux como sistema, no como estética de distro. Cinco partes para pasar de copiar comandos a entender qué hace cada uno. Pensada para quien ya lo usa en la facu o en el laburo y quiere dejar de adivinar.",
    plannedParts: 5,
    upcoming: [
      {
        part: 4,
        title: "Procesos y servicios: qué está corriendo en tu máquina",
        summary: "PIDs, señales, `systemctl` y cómo encontrar qué proceso ocupa un puerto.",
        date: "2026-09-16",
      },
      {
        part: 5,
        title: "Logs: leer lo que el sistema ya te está diciendo",
        summary: "`journalctl`, `/var/log` y cómo filtrar hasta la línea que importa.",
        date: "2026-09-30",
      },
    ],
    facts: [
      { title: "Antes de empezar", body: "Una máquina con Linux, una VM o WSL. No hace falta saber nada de la terminal." },
      { title: "Al terminar", body: "Vas a leer un error de permisos y saber qué cambiar, y a ir al log correcto sin adivinar." },
      { title: "Para practicar", body: "Cada parte tiene su lab en Open Security Labs." },
    ],
    createdAt: at("2026-07-10T12:00:00Z"),
  },
  {
    id: "s-repos",
    slug: "seguridad-en-repos",
    title: "Seguridad en repos",
    summary: "Secretos, historial, Actions y dependencias: lo que tu repo expone sin que lo sepas.",
    description:
      "Qué deja expuesto un repo aunque el código esté bien: secretos en el historial, logs de Actions y dependencias que no elegiste.",
    plannedParts: 5,
    upcoming: [{ part: 3, title: "Secretos en GitHub Actions sin dejarlos en los logs", summary: "", date: "2026-09-23" }],
    facts: [],
    createdAt: at("2026-07-05T12:00:00Z"),
  },
  {
    id: "s-prod",
    slug: "produccion-de-verdad",
    title: "Producción de verdad",
    summary: "Timeouts, retries, logs y alertas: lo que no aparece cuando todo corre en tu máquina.",
    description: "Lo que cambia cuando tu proyecto deja de correr solo en tu máquina.",
    plannedParts: 4,
    upcoming: [],
    facts: [],
    createdAt: at("2026-07-01T12:00:00Z"),
  },
];

for (const s of series) {
  await client.execute({
    sql: `INSERT INTO series (id, slug, title, summary, description, planned_parts, upcoming, facts, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [s.id, s.slug, s.title, s.summary, s.description, s.plannedParts, JSON.stringify(s.upcoming), JSON.stringify(s.facts), s.createdAt],
  });
}

/* ---------- artículos ---------- */

const short = (lead) => `${lead}\n\n## Qué vas a ver\n\nTexto de ejemplo para la maqueta: el artículo completo todavía no está cargado.\n\n## El criterio\n\nMás texto de ejemplo.`;

// [id, slug, title, excerpt, content, tags, publishedAt, seriesId, seriesOrder, issueNumber]
const articles = [
  ["a-env", "subiste-el-env-a-github", "Subiste el .env a GitHub: qué pasa en los primeros minutos",
    "Borrar el archivo no borra la key. Qué hacer, en qué orden, y por qué rotar va antes que limpiar el historial.",
    md("env"), ["git", "secretos"], "2026-09-09T13:00:00Z", "s-repos", 2, null],
  ["a-chmod", "permisos-chmod-777", "Permisos: quién puede hacer qué, y por qué chmod 777 no es la respuesta",
    "Dueño, grupo y el resto. Cómo leer `ls -l` y arreglar un 403 sin abrir todo.",
    md("chmod"), ["linux", "permisos"], "2026-09-02T13:00:00Z", "s-linux", 3, null],
  ["a-readme", "tu-readme-de-github", "Tu README de GitHub es el CV que te leen antes de la entrevista",
    "Qué mira alguien que contrata en los primeros segundos, y qué no le importa nada.",
    short("Un README que explica qué resuelve el proyecto vale más que diez repos sin descripción."), ["carrera"], "2026-08-26T13:00:00Z", null, null, null],
  ["a-docker", "docker-y-el-env", "Docker y el .env: cómo tu secreto termina adentro de la imagen",
    "Cada `COPY` es una capa, y borrar en la capa siguiente no la borra.",
    short("Una imagen de Docker es una pila de capas, y cada una guarda lo que le copiaste."), ["docker", "secretos"], "2026-08-19T13:00:00Z", null, null, null],
  ["a-linux", "uso-linux-todos-los-dias", "Uso Linux todos los días: qué cambió en mi forma de trabajar",
    "No es la distro. Es entender qué proceso hace qué y dónde está el log cuando algo falla.",
    short("Lo que cambió no fue el escritorio, fue cómo busco lo que falla."), ["linux"], "2026-08-12T13:00:00Z", null, null, null],
  ["a-secreto", "que-es-un-secreto", "Qué es un secreto y por qué termina en un repo",
    "Keys, tokens y contraseñas: qué pueden hacer si salen de tu máquina.",
    short("Un secreto es cualquier cosa que da acceso sin preguntarte."), ["secretos"], "2026-08-05T13:00:00Z", "s-repos", 1, null],
  ["a-empezar", "si-empezara-hoy-en-ciberseguridad", "Si empezara hoy en ciberseguridad: un mapa, no una escalera",
    "Por dónde arrancaría, qué dejaría para después y qué evidencia armaría para el primer trabajo.",
    short("No hay un orden único, pero sí cosas que conviene tener antes que otras."), ["carrera"], "2026-07-29T13:00:00Z", null, null, null],
  ["a-rutas", "archivos-y-rutas", "Archivos y rutas: qué significa que en Linux todo es un archivo",
    "El árbol desde `/`, rutas absolutas y relativas, y por qué `/proc` también es un archivo.",
    short("Todo arranca en `/`, y casi todo lo que ves ahí es un archivo."), ["linux"], "2026-07-22T13:00:00Z", "s-linux", 2, null],
  ["a-shell", "el-shell-que-pasa-cuando-apretas-enter", "El shell: qué pasa cuando apretás Enter",
    "Qué es un shell, cómo busca un comando en el `PATH` y por qué conviene leer el error entero.",
    short("Entre que apretás Enter y aparece la respuesta pasan varias cosas."), ["linux"], "2026-07-15T13:00:00Z", "s-linux", 1, null],
  // Apuntes
  ["q-04", "apuntes-04-docker-capas", "Docker, capas y un secreto que no se va",
    "Una quincena con contenedores. Lo de las capas lo preguntaron tres veces en el Discord.",
    md("apuntes-04"), ["apuntes"], "2026-09-11T13:00:00Z", null, null, 4],
  ["q-03", "apuntes-03-env-readme-chmod", "El .env, el README y un chmod 777",
    "Hola. Dos semanas con mucho Git. Lo del .env salió de varios mensajes en el Discord con el mismo problema, así que le dediqué un video y un artículo entero.",
    md("apuntes-03"), ["apuntes"], "2026-08-28T13:00:00Z", null, null, 3],
  ["q-02", "apuntes-02-linux", "Uso Linux todos los días",
    "Lo que cambió en mi forma de trabajar, sin guerra de distros.",
    md("apuntes-04").replace("Docker", "Linux"), ["apuntes"], "2026-08-14T13:00:00Z", null, null, 2],
  ["q-01", "apuntes-01-si-empezara-hoy", "Si empezara hoy",
    "Por qué existe este newsletter, y el mapa que usaría si arrancara de cero.",
    md("apuntes-04").replace("Docker", "el mapa"), ["apuntes"], "2026-07-31T13:00:00Z", null, null, 1],
  ["a-draft", "borrador-actions", "Secretos en GitHub Actions sin dejarlos en los logs", "", "Borrador.", [], null, "s-repos", 3, null],
];

for (const [id, slug, title, excerpt, content, tags, publishedAt, seriesId, seriesOrder, issueNumber] of articles) {
  const ts = publishedAt ? at(publishedAt) : at("2026-09-12T12:00:00Z");
  await client.execute({
    sql: `INSERT INTO articles (id, slug, title, excerpt, content, cover_image, tags, status, published_at, created_at, updated_at, series_id, series_order, issue_number)
          VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, slug, title, excerpt, content, JSON.stringify(tags), publishedAt ? "published" : "draft", publishedAt ? ts : null, ts, ts, seriesId, seriesOrder, issueNumber],
  });
}

/* ---------- comentarios ---------- */

const comments = [
  ["c1", "a-env", null, "Lectora de ejemplo", "Me pasó con el token de un bot de Discord. Lo borré del repo y pensé que pasarlo a privado alcanzaba. No sabía lo de los forks.", "approved", "2026-09-10T18:00:00Z"],
  ["c2", "a-env", "c1", "Valentín", "gracias por contarlo, es justo el caso de por qué rotar va primero. mucha fuerza con el bot", "approved", "2026-09-10T20:00:00Z"],
  ["c3", "a-env", null, "Spam", "pendiente de moderación", "pending", "2026-09-11T10:00:00Z"],
];
for (const [id, articleId, parentId, username, content, status, createdAt] of comments) {
  await client.execute({
    sql: `INSERT INTO comments (id, article_id, parent_id, username, content, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?, 'seed', ?, ?)`,
    args: [id, articleId, parentId, username, content, status, at(createdAt)],
  });
}

console.log(`seeded ${path}`);

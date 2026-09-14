/**
 * Compara el HTML server-rendered (y respuestas no-HTML clave) de dos builds.
 *
 *   node tests/parity/html-diff.mjs http://localhost:3101 http://localhost:3102 [outDir]
 *
 * Normaliza lo que cambia por request o por build: nonces de la CSP, hashes
 * de chunks de /_next/static, el buildId y el payload RSC en <script>
 * (se compara aparte, solo el texto visible). Imprime un diff unificado por
 * página con diferencias y termina con código 1 si hubo alguna.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [base, next, outDir = "test-results/parity-html"] = process.argv.slice(2);
if (!base || !next) {
  console.error("uso: node tests/parity/html-diff.mjs <baseUrl> <nextUrl> [outDir]");
  process.exit(2);
}

const PAGES = [
  "/",
  "/?tag=pericias",
  "/?pagina=2",
  "/articulo/el-rol-de-la-pericia",
  "/articulo/sin-portada",
  "/archivo",
  "/archivo/2024/05",
  "/acerca",
  "/buscar",
  "/buscar?q=pericia",
  "/buscar?q=zzzz",
  "/buscar?q=a",
  "/admin/login",
  "/no-existe",
  "/robots.txt",
  "/sitemap.xml",
  // Rutas de features que yanina no tiene: tienen que seguir dando el mismo 404
  "/series",
  "/serie/linux-desde-cero",
  "/apuntes",
  "/apuntes/3",
  "/feed.xml",
];
const BINARY = ["/icon.svg", "/opengraph-image", "/api/og/el-rol-de-la-pericia", "/api/og/no-existe"];

/**
 * Diferencias esperadas al mover código de carpeta, sin efecto visual:
 * - next/font nombra la clase de la variable con un hash de la RUTA del módulo
 *   que llama a la fuente (`geist_<hash>-module__<hash>__variable`); el CSS que
 *   define la variable es el mismo.
 * - el id de una server action es un hash del módulo que la define.
 * Se normalizan acá y se reportan aparte (ver KNOWN).
 */
const KNOWN = [
  [/([a-z_]+)_[0-9a-f]{8}-module__[A-Za-z0-9_-]{6}__variable/g, "$1_FONT__variable"],
  [/(ACTION_[0-9]+:0" value="\{&quot;id&quot;:&quot;)[0-9a-f]{42}/g, "$1ACTIONID"],
  [/("id":")[0-9a-f]{42}(","bound")/g, "$1ACTIONID$2"],
  [/\$ACTION_ID_[0-9a-f]{42}/g, "$ACTION_ID_X"],
];

function known(text) {
  return KNOWN.reduce((t, [re, to]) => t.replace(re, to), text);
}

function normalize(html) {
  return (
    known(html)
      .replace(/nonce="[^"]*"/g, 'nonce="N"')
      .replace(/\/_next\/static\/[^"'\s)\\]+/g, "/_next/static/X")
      .replace(/opengraph-image\?[0-9a-f]+/g, "opengraph-image?H")
      // payload RSC inline: se compara por separado
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script/>")
      .replace(/></g, ">\n<")
  );
}

/** Texto de los chunks RSC (self.__next_f.push) sin referencias a chunks ni buildId */
function rscPayload(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1])[1] ?? "";
    } catch {
      return m[1];
    }
  });
  return known(chunks.join(""))
    .replace(/\/_next\/static\/[^"'\s)\\]+/g, "/_next/static/X")
    .replace(/"b":"[^"]+"/g, '"b":"BUILD"')
    .replace(/nonce[^,]*?"[A-Za-z0-9+/=]{20,}"/g, 'nonce:"N"')
    .replace(/opengraph-image\?[0-9a-f]+/g, "opengraph-image?H")
    // ids de módulos/chunks client: cambian al mover archivos de carpeta
    .replace(/^[0-9a-f]+:I\[.*$/gm, "I[module]")
    .replace(/\\?"\$L?[0-9a-f]+\\?"/g, '"$REF"')
    .replace(/(^|\n)[0-9a-f]+:/g, "$1ID:")
    .split(/(?<=[}\]])(?=\n|$)|\n/)
    .join("\n");
}

/**
 * Panel admin: con PARITY_AUTH_SECRET (el AUTH_SECRET de los dos servidores)
 * se firma una sesión y se comparan también las páginas del panel. Verifica de
 * paso que la cookie (`pluma_session`) y el JWT (iss/aud) sigan siendo válidos.
 */
const ADMIN_PAGES = ["/admin", "/admin/comentarios", "/admin/configuracion", "/admin/articulos/nuevo", "/admin/articulos/a1"];
let cookie = "";
if (process.env.PARITY_AUTH_SECRET) {
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({ sub: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pluma")
    .setAudience(process.env.PARITY_TENANT ?? "yanina")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.PARITY_AUTH_SECRET));
  cookie = `${process.env.PARITY_COOKIE ?? "pluma_session"}=${token}`;
  PAGES.push(...ADMIN_PAGES);
}

async function get(url) {
  const res = await fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { status: res.status, type: res.headers.get("content-type"), body: Buffer.from(await res.arrayBuffer()) };
}

mkdirSync(outDir, { recursive: true });
let failures = 0;

function diff(name, a, b) {
  if (a === b) return false;
  const fa = join(outDir, `${name}.base.txt`);
  const fb = join(outDir, `${name}.next.txt`);
  writeFileSync(fa, a);
  writeFileSync(fb, b);
  try {
    execFileSync("diff", ["-u", fa, fb], { encoding: "utf8" });
  } catch (e) {
    console.log(e.stdout);
  }
  return true;
}

for (const path of PAGES) {
  const [a, b] = await Promise.all([get(base + path), get(next + path)]);
  const slug = path.replace(/[^a-z0-9]+/gi, "_") || "root";
  const htmlA = a.body.toString("utf8");
  const htmlB = b.body.toString("utf8");
  const statusSame = a.status === b.status && a.type === b.type;
  const domDiff = diff(`${slug}.html`, normalize(htmlA), normalize(htmlB));
  const rscDiff = diff(`${slug}.rsc`, rscPayload(htmlA), rscPayload(htmlB));
  const ok = statusSame && !domDiff && !rscDiff;
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "DIFF"} ${path} (status ${a.status}/${b.status}${domDiff ? ", html" : ""}${rscDiff ? ", rsc" : ""})`,
  );
}

for (const path of BINARY) {
  const [a, b] = await Promise.all([get(base + path), get(next + path)]);
  const ha = createHash("sha256").update(a.body).digest("hex").slice(0, 16);
  const hb = createHash("sha256").update(b.body).digest("hex").slice(0, 16);
  const ok = a.status === b.status && a.type === b.type && ha === hb;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "DIFF"} ${path} (status ${a.status}/${b.status}, ${a.type}, sha ${ha}/${hb})`);
}

console.log(failures ? `\n${failures} diferencia(s)` : "\nSin diferencias");
process.exit(failures ? 1 : 0);

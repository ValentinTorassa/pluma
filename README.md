# 🪶 pluma

**Plataforma de blog open source para un solo autor.** Pensada para profesionales que quieren publicar artículos con imágenes, recibir upvotes anónimos y moderar comentarios — sin depender de WordPress ni de plataformas de terceros.

La primera usuaria es **Yanina L. Colombero**, Lic. en Psicología (forense y criminología, Santa Fe, Argentina), pero cualquiera puede hacer fork y configurar su propio blog editando un solo archivo.

## Características

- ✍️ **Panel de administración** con editor Markdown, vista previa y subida de imágenes
- 🖼️ **Imágenes** alojadas en Vercel Blob (portadas + dentro del contenido)
- ▲ **Upvotes anónimos** — 1 voto por IP (se guarda solo un hash SHA-256, nunca la IP)
- 💬 **Comentarios anónimos** con seudónimo, **aprobación previa** desde el panel, rate-limit y filtro anti-links
- 🏷️ Tags, borradores, paginación, sitemap y Open Graph
- 🔐 Usuario admin único (credenciales por variables de entorno, sesión JWT)
- ⚙️ **Configuración del autor en un solo archivo**: `src/pluma.config.ts`

## Stack

Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS 4 · Turso (SQLite) + Drizzle ORM · Vercel Blob · jose (JWT)

## Setup local

```bash
npm install
cp .env.example .env.local   # completar valores
npm run db:push              # crea las tablas en Turso
npm run dev
```

Variables de entorno (ver `.env.example`):

| Variable | Descripción |
|---|---|
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Base de datos ([turso.tech](https://turso.tech), tier gratis) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciales del panel `/admin` |
| `AUTH_SECRET` / `IP_SALT` | `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Se completa con `vercel env pull` tras linkear Blob |
| `NEXT_PUBLIC_SITE_URL` | URL pública (SEO, sitemap) |

## Deploy en Vercel

Sitio en producción: **https://yaninacolombero.com** (`www` redirige al dominio raíz).
El repo está conectado a Vercel, así que cada push a `main` dispara un deploy automático.

1. Subí el repo a GitHub e importalo en [vercel.com/new](https://vercel.com/new)
2. Agregá las variables de entorno del `.env.local`
3. En el dashboard de Vercel: **Storage → Create → Blob** y linkealo al proyecto (setea `BLOB_READ_WRITE_TOKEN` solo)
4. Deploy 🚀

### Dominio propio

`yaninacolombero.com` está registrado en DonWeb y usa sus nameservers
(`ns1/ns2.donweb.com`), con la zona DNS apuntando a Vercel:

| Tipo | Nombre | Contenido |
|---|---|---|
| `A` | `yaninacolombero.com` | `216.198.79.1` |
| `CNAME` | `www.yaninacolombero.com` | `yaninacolombero.com` |

Al cambiar de dominio hay que actualizar `NEXT_PUBLIC_SITE_URL` en Vercel
(la usan el sitemap, `robots.txt`, los canonical y las imágenes de Open Graph)
y redeployar para que el build tome el valor nuevo.

## Personalizar para otro autor

Editá `src/pluma.config.ts`: nombre del sitio, autor, bio, rol, email, LinkedIn, tamaño de página y blacklist de comentarios. No hace falta tocar nada más.

## Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generar una migración SQL en `drizzle/` a partir de `src/db/schema.ts` (offline) |
| `npm run db:push` | Sincronizar schema con Turso — **solo bases locales/de desarrollo**, ver abajo |
| `npm run db:studio` | Explorador visual de la DB |
| `npm run test:visual` | Regresión visual contra `BASE_URL` (por defecto producción) |
| `npm run test:visual:update` | Regenerar las capturas de referencia |
| `npx tsx --env-file=.env.local scripts/seed.ts` | Insertar artículo de ejemplo |

## Cambios de schema en producción

> ⚠️ **`npm run db:push` nunca debe apuntar a la base de producción.** `drizzle-kit push`
> aplica el diff directo, sin revisión, y puede borrar columnas o tablas con datos.

- `drizzle/0000_baseline.sql` es la **línea base**: representa el schema que ya existe en
  producción (creado originalmente con `db:push`). No se ejecuta contra producción; si alguna
  vez se adopta `drizzle-kit migrate` hay que marcarla como aplicada primero.
- Todo cambio de schema: editar `src/db/schema.ts` → `npm run db:generate` → commitear el SQL
  generado en `drizzle/` → revisarlo en el PR.
- Las migraciones de producción deben ser **aditivas** (tablas/columnas nuevas nullable o con
  default, índices). Renombrar o borrar columnas/tablas se hace en varios pasos y PRs separados.

## CI

`.github/workflows/ci.yml` corre en cada PR y push a `main`: `npm ci`, `lint`, `tsc --noEmit` y
`next build` con variables de entorno ficticias (el build no toca la base: todas las páginas
son dinámicas).

## Regresión visual

`tests/visual/yanina.spec.ts` (Playwright) saca capturas de página completa de home, primer
artículo, `/archivo`, `/acerca` y `/buscar` en desktop (1280px) y mobile (390px), y las compara
con las de referencia en `tests/visual/yanina.spec.ts-snapshots/`. No está en CI (requiere red).

```bash
npx playwright install chromium          # una vez
npm run test:visual                      # contra https://yaninacolombero.com
BASE_URL=https://<preview>.vercel.app npm run test:visual   # contra un preview de un PR
npm run test:visual:update               # regenerar referencias (solo desde producción)
```

Si el preview tiene Deployment Protection, agregar `VERCEL_BYPASS_TOKEN=<token>`: el test lo
manda como header `x-vercel-protection-bypass`.

## Licencia

MIT

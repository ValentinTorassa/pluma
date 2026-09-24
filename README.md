# 🪶 pluma

**Plataforma de blog open source para un solo autor.** Pensada para profesionales que quieren publicar artículos con imágenes, recibir upvotes anónimos y moderar comentarios - sin depender de WordPress ni de plataformas de terceros.

La primera usuaria es **Yanina L. Colombero**, Lic. en Psicología (forense y criminología, Santa Fe, Argentina), pero cualquiera puede hacer fork y configurar su propio blog editando un solo archivo.

**Blogs en vivo:** [VT Security](https://vtsecurity.com.ar) (también en https://blog.valentorassa.com) · [Yanina L. Colombero](https://yaninacolombero.com)

## Características

- ✍️ **Panel de administración** con editor Markdown, vista previa y subida de imágenes
- 🖼️ **Imágenes** alojadas en Vercel Blob (portadas + dentro del contenido)
- ▲ **Upvotes anónimos** - 1 voto por IP (se guarda solo un hash SHA-256, nunca la IP)
- 💬 **Comentarios anónimos** con seudónimo, **aprobación previa** desde el panel, rate-limit y filtro anti-links
- 🏷️ Tags, borradores, paginación, sitemap y Open Graph
- 🔐 Usuario admin único (credenciales por variables de entorno, sesión JWT)
- ⚙️ **Varias instancias desde un mismo código**: cada blog es un tenant en `src/tenants/<tenant>/`

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

## Tenants (varias instancias)

Un mismo repo sirve blogs **aislados**: cada uno es un proyecto de Vercel con su propia base,
Blob, secretos y dominio. El tenant se elige en build con `PLUMA_TENANT`:

| Tenant | Sitio | `PLUMA_TENANT` |
|---|---|---|
| `yanina` | https://yaninacolombero.com | (sin setear) o `yanina` |
| `vt` | VT Security blog (diseño v3.1 con figuras interactivas, admin de series y API de publicación; listmonk pendiente) | `vt` |

Todo lo específico de un blog vive en `src/tenants/<tenant>/`: `config.ts` (sitio, autor,
locale, zona horaria, features, prefijos de localStorage/Blob y cookie), `messages.ts` (todos
los textos), `theme.css` (tokens de Tailwind), `fonts.ts`, `Logo.tsx`, `og.tsx`, `icon.svg` y
`slots/` (Header, HomeHero, ArticleCard, Footer) y `pages/` (páginas completas). El contrato
está en `src/tenants/types.ts`.

```bash
npm run build                    # yanina
PLUMA_TENANT=vt npm run build    # vt
PLUMA_TENANT=vt npm run dev
```

Para ver `vt` con contenido de ejemplo (series, artículo con figuras, Apuntes), sobre una
SQLite local:

```bash
TURSO_DATABASE_URL=file:$PWD/vt.db node scripts/seed-vt.mjs
PLUMA_TENANT=vt TURSO_DATABASE_URL=file:$PWD/vt.db AUTH_SECRET=dev IP_SALT=dev \
  ADMIN_USERNAME=a ADMIN_PASSWORD=a npm run dev
```

Features de `vt` (en `config.features`): resaltado con Shiki, directivas y figuras, `/feed.xml`,
series (`/series`, `/serie/[slug]`), archivo de Apuntes (`/apuntes`, `/apuntes/[n]`) y
formulario de newsletter (`NEWSLETTER_SUBSCRIBE_URL`; sin la variable se muestra deshabilitado).
El retrato no está en `public/`: el avatar es un SVG del tenant (`src/tenants/vt/Avatar.tsx`).

### Publicación en `vt` (admin y API)

Solo en tenants con `src/tenants/<tenant>/publishing.ts` distinto de `null` (yanina no tiene: su
admin no cambia y `/api/v1` no existe):

- **Admin**: `/admin/series` (listar, crear, editar; borrar solo series sin artículos) con la
  feature `series`. En el editor de artículos: serie y parte, número de Apuntes (feature
  `apuntes`) y una vista previa con el mismo pipeline que el sitio (figuras incluidas).
- **API para agentes** (feature `publicApi`), con `Authorization: Bearer <token>`:

| Método y ruta | Scope | Qué hace |
|---|---|---|
| `POST /api/v1/posts` | `posts:write` | Crea un artículo. Borrador por defecto; `status: "published"` requiere además `posts:publish` |
| `PATCH /api/v1/posts` | `posts:write` | Edita el artículo de `id` (o de `slug` si no hay `id`); solo cambian los campos enviados. Publicar, despublicar o tocar uno ya publicado requiere `posts:publish` |
| `PATCH /api/v1/posts/[slug]` | `posts:write` | Lo mismo, identificando el artículo por la URL (el body no lleva `id` ni `slug`; para renombrar, usar `PATCH /api/v1/posts` con `id`) |
| `GET /api/v1/posts/[slug]` | `posts:read` | Un artículo en cualquier estado |
| `GET /api/v1/series` | `posts:read` | Series con partes planeadas y publicadas |
| `POST /api/v1/series` | `series:write` | Crea una serie |

Campos de un artículo: `title`, `slug`, `excerpt`, `content` (Markdown con directivas), `tags`
(array o `"a, b"`), `coverImage` (https o `/ruta`), `status` (`draft`/`published`), `series`
(slug de la serie o `null`), `seriesOrder` y `issueNumber` (número de Apuntes). Un campo
desconocido o inválido responde 400 con `errors: [{ field, code }]`; slug o número repetido, 409.
`posts:write` y `posts:publish` incluyen `posts:read`, pero **`posts:publish` no incluye
`posts:write`**: un token que solo tenga `posts:publish` recibe 403 en cualquier PATCH, porque la
ruta pide `posts:write` en la puerta y recién adentro chequea el permiso de publicar. Para
publicar hace falta un token con **los dos**. Rate limit: 120 llamadas cada 10 min por token y 10
intentos con token inválido cada 15 min por IP.

Los tokens se guardan hasheados (SHA-256, tabla `api_tokens`, migración `drizzle/0003`) y se
muestran una sola vez al crearlos:

```bash
TURSO_DATABASE_URL=file:$PWD/vt.db node scripts/create-api-token.mjs --name "agente" --scopes posts:write
curl -X POST http://localhost:3000/api/v1/posts -H "Authorization: Bearer pluma_…" \
  -H "Content-Type: application/json" -d '{"title":"Borrador","content":"Hola"}'
```

```bash
TURSO_DATABASE_URL=file:$PWD/vt.db node scripts/create-api-token.mjs --list          # id, nombre, scopes, uso (nunca el token)
TURSO_DATABASE_URL=file:$PWD/vt.db node scripts/create-api-token.mjs --revoke <id>   # deja de valer al instante
```

El script se niega a usar una base que no sea local salvo con `--allow-remote` (en los tres modos).

**Agregar un blog:** copiar `src/tenants/vt/` a `src/tenants/<nuevo>/`, adaptar los archivos,
crear `tsconfig.<nuevo>.json` (copia de `tsconfig.vt.json` con la ruta nueva), agregarlo a la
matriz de `.github/workflows/ci.yml` y crear un proyecto de Vercel con `PLUMA_TENANT=<nuevo>`.
Detalles de cómo se resuelve el alias `@tenant` (TS, Turbopack, CSS, ícono) en `AGENTS.md`.

### Métricas de `vt` (voto, visitas y analytics)

- **Voto del artículo**: la tabla `upvotes`, `/api/upvote` y el rate limit (1 voto por hash de IP)
  son compartidos y existen desde el principio; cada tenant decide si los muestra. `vt` tiene su
  propio botón en tinta (`src/tenants/vt/components/Upvote.tsx`); la lista del home no muestra
  conteos a propósito.
- **Contador propio de visitas** (feature `views`, migración `drizzle/0004`):

  | Tabla | Qué guarda |
  |---|---|
  | `article_views` | agregado por `(article_id, day)`: `views` y `uniques`. Es el histórico |
  | `article_view_hits` | `(article_id, day, ip_hash)`, solo para deduplicar el día. Podable |

  `POST /api/view` es **feature route**: un tenant sin `views` no tiene la ruta. Lo llama el
  navegador 1,2 s después de pintar (`ViewBeacon`), así los prefetch de Next y los bots que no
  ejecutan JS no cuentan; si falla, falla callado. El día se calcula en `config.timeZone`, no en
  UTC. Consultas listas en `src/lib/views.ts`: `getViewTotals`, `getViewSeries`, `pruneViewHits`.

  **No cuenta las visitas del admin**: si hay sesión iniciada, el artículo no monta el
  `ViewBeacon`. Sí cuenta cualquier otra visita propia (otro navegador, el celular, incógnito),
  así que los primeros días de un artículo conviene mirarlos con pinzas.

- **Vercel Web Analytics**: `@vercel/analytics` se monta en el **Footer del tenant**
  (`src/tenants/vt/slots/Footer.tsx`), no en el layout compartido, así el bundle de los demás
  tenants no lo incluye. El script se inyecta del lado del cliente y en este proyecto sale por una
  ruta ofuscada (`/<hash>/script.js`), no por `/_vercel/insights/script.js`: **buscarlo con `curl`
  en el HTML del servidor da un falso negativo**. Para comprobar que anda, mirar `window.va` y
  `window.vaq` en el navegador. El plan del team es `hobby`, con tope mensual de eventos.

## Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generar una migración SQL en `drizzle/` a partir de `src/db/schema.ts` (offline) |
| `npm run db:push` | Sincronizar schema con Turso - **solo bases locales/de desarrollo**, ver abajo |
| `npm run db:studio` | Explorador visual de la DB |
| `npm run test:visual` | Regresión visual contra `BASE_URL` (por defecto producción) |
| `npm run test:visual:update` | Regenerar las capturas de referencia |
| `npx tsx --env-file=.env.local scripts/seed.ts` | Insertar artículo de ejemplo |
| `node scripts/create-api-token.mjs --name … --scopes …` | Crear un token de `/api/v1` (lo imprime una vez); `--list` y `--revoke <id>` para listarlos y revocarlos |

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

`.github/workflows/ci.yml` corre en cada PR y push a `main`: `lint` y tests unitarios una vez,
y `tsc` + `next build` **por tenant** (matriz `yanina`, `vt`) con variables de entorno ficticias
y una SQLite local creada desde `drizzle/` (nunca Turso).

## Paridad entre builds (yanina tiene que quedar idéntica)

Cuando un cambio toca código compartido o `src/tenants/yanina/`, producción no debe cambiar.
Para probarlo se comparan dos builds locales (rama base vs. rama nueva) sobre la **misma**
SQLite sembrada con contenido fijo:

```bash
DB=/tmp/parity.db
TURSO_DATABASE_URL=file:$DB node tests/parity/seed.mjs
ENV="TURSO_DATABASE_URL=file:$DB AUTH_SECRET=parity IP_SALT=parity ADMIN_USERNAME=a ADMIN_PASSWORD=a NEXT_PUBLIC_SITE_URL=http://localhost:3000"
# en un checkout de la rama base:  env $ENV npx next build && env $ENV npx next start -p 3101
# en la rama nueva:                env $ENV npx next build && env $ENV npx next start -p 3102

# 1) capturas (sin tolerancia): referencia del build base, después comparar el nuevo
export PARITY_SNAPSHOTS=/tmp/parity-snapshots
BASE_URL=http://localhost:3101 npx playwright test -c tests/parity/playwright.config.ts --update-snapshots
BASE_URL=http://localhost:3102 npx playwright test -c tests/parity/playwright.config.ts

# 2) HTML + payload RSC + hash de ícono/OG (con sesión admin firmada para el panel)
PARITY_AUTH_SECRET=parity node tests/parity/html-diff.mjs http://localhost:3101 http://localhost:3102
```

`html-diff.mjs` ignora nonces, hashes de `/_next/static` y dos diferencias esperadas sin efecto
visual cuando se mueve código de carpeta: el nombre de la clase de next/font (hash de la ruta
del módulo) y el id de las server actions.

**Si `playwright install chromium` falla**, el paso de las capturas no se puede correr. Pasa: es
una descarga de 114 MB que a veces se corta. No sirve dar la paridad por buena con el `html-diff`
solo, porque ese compara el HTML y el RSC pero **no** el CSS compilado. El reemplazo mínimo
mientras tanto es traer las hojas de estilo de los dos builds y compararlas:

```bash
for p in 3101 3102; do
  curl -s "http://localhost:$p/" | grep -o '/_next/static/[^"]*\.css' | sort -u \
    | while read -r u; do curl -s "http://localhost:$p$u"; done > /tmp/css-$p.txt
done
diff -q /tmp/css-3101.txt /tmp/css-3102.txt && echo "CSS idéntico"
```

Con HTML, RSC y CSS iguales no debería haber diferencia visual, pero **no es lo mismo que
haberla medido**: decilo así en el PR en vez de escribir "paridad OK".

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

[MIT](LICENSE).

## Verificación de regresiones - 2026-09-14

```bash
npm ci
npm run verify
npm run build
```

Fixtures sintéticos: credenciales, JWT admin, redirects y visibilidad de comentarios. La base SQLite se crea en un directorio temporal. `verify` conserva la suite Vitest existente, suma `test:admin` y genera los tipos de rutas antes de typecheck. La matriz CI existente construye ambos tenants con la SQLite local de migraciones.

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
| `npm run db:push` | Sincronizar schema con Turso |
| `npm run db:studio` | Explorador visual de la DB |
| `npx tsx --env-file=.env.local scripts/seed.ts` | Insertar artículo de ejemplo |

## Licencia

MIT

## Verificación de regresiones — 2026-09-14

```bash
npm ci
npm run verify
npm run build
```

Fixtures sintéticos: credenciales, JWT admin, redirects y visibilidad de comentarios. La base SQLite se crea en un directorio temporal. `verify` genera primero los tipos de rutas para funcionar también en un checkout limpio.

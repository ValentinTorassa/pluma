<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Proyecto: pluma

Plataforma de blog open source para un solo autor. UI en español (es-AR). Un mismo código sirve **varias instancias aisladas** (tenants): hoy `yanina` (producción, https://yaninacolombero.com) y `vt` (VT Security, en construcción).

## Tenants (multi-instancia)

- Cada tenant es un **proyecto de Vercel aparte** (su base Turso, Blob, secretos y dominio). El tenant se elige en **build** con `PLUMA_TENANT` (por defecto `yanina`). No hay multi-tenant en runtime.
- Todo lo específico de un tenant vive en `src/tenants/<tenant>/`:
  - `config.ts` — sitio, autor, `locale`/`lang`/`timeZone`, blacklist, `features`, `storagePrefix` (localStorage), `blobPrefix` (Vercel Blob), `sessionCookie`. Los textos públicos del autor se pueden sobreescribir desde `/admin/configuracion` (tabla `settings`, ver `src/lib/settings.ts`).
  - `messages.ts` — **todos** los textos de UI, API y actions. Nada de strings sueltos en componentes o rutas.
  - `theme.css` — entrada CSS: `@import "../../app/globals.css"` + tokens `@theme` (`paper`, `ink`, `muted`, `accent`, `accent-soft`, `line`, fuentes).
  - `fonts.ts` (next/font), `Logo.tsx`, `og.tsx` (imágenes Open Graph), `icon.svg`.
  - `slots/` — componentes cuyo layout cambia por tenant: `Header`, `HomeHero`, `ArticleCard`, `Footer`.
  - `index.ts` — `satisfies TenantModule`: si el tenant no cumple el contrato de `src/tenants/types.ts`, `tsc` falla.
- Cómo se resuelve `@tenant/*`:
  - **JS/TS en build**: `next.config.ts` valida el tenant (carpeta existente + archivos obligatorios) y setea `turbopack.resolveAlias` (y alias de webpack) `@tenant → ./src/tenants/<tenant>`.
  - **TypeScript**: `tsconfig.json` apunta `@tenant/*` a yanina; `tsconfig.<tenant>.json` lo apunta al resto (next.config usa ese archivo vía `typescript.tsconfigPath`; CI corre `tsc -p` por tenant).
  - **CSS**: Tailwind resuelve los `@import` de CSS por su cuenta y **no ve el alias**. Por eso `app/layout.tsx` importa `@tenant/theme.css` desde JS (ahí sí aplica el alias) y ese archivo importa `globals.css` con ruta relativa.
  - **Ícono**: `next.config.ts` copia `src/tenants/<tenant>/icon.svg` a `src/app/icon.svg` (generado, en `.gitignore`) para conservar la URL `/icon.svg?icon.<hash>.svg` de producción.
- Reglas:
  - Dentro de `src/tenants/` se usan imports relativos (y `@/…` para lo compartido), **nunca** `@tenant/*` (ESLint lo bloquea).
  - Código compartido: `@tenant/config`, `@tenant/messages`, `@tenant/slots/*`, etc. Nunca `if (tenant === …)`.
  - Para un texto concatenado con valores, respetar los nodos de texto originales (`{"Página "}{n}` ≠ `{`Página ${n}`}` en el HTML de React).
- Agregar un tenant: copiar `src/tenants/vt/` a `src/tenants/<nuevo>/`, completar el contrato, crear `tsconfig.<nuevo>.json`, sumarlo a la matriz de CI y crear el proyecto de Vercel con `PLUMA_TENANT=<nuevo>`.

### Yanina tiene que quedar idéntica

Cualquier cambio en código compartido o en `src/tenants/yanina/` debe dejar **igual** el sitio de producción (HTML, clases, textos, fuentes, colores, rutas, OG, ícono, claves `pluma:*` de localStorage, cookie `pluma_session`, prefijo `pluma/` de Blob). Verificarlo comparando contra la rama base con `tests/parity/` (ver README → Paridad entre builds): capturas sin tolerancia + diff de HTML/RSC + hash de ícono y OG.

## Estructura

- `src/app/(public)/` — blog público (home, artículo, acerca). Páginas con `force-dynamic` (datos frescos de Turso).
- `src/app/admin/` — panel. `login/` es público; `(panel)/` requiere sesión. Las actions están en `src/app/admin/actions.ts` (cuidado: los route groups cuentan como directorio para los imports relativos).
- `src/app/api/` — `upvote` (toggle anónimo por IP-hash), `comentarios` (crea pendiente de aprobación), `upload` (Vercel Blob, solo admin).
- `src/proxy.ts` — protege `/admin/*` (Next.js 16: `proxy.ts` reemplaza a `middleware.ts`).
- `src/db/` — Drizzle + Turso. Migraciones en `drizzle/` (`0000_baseline` = schema actual de producción).
- `tests/visual/` — regresión visual con Playwright contra `BASE_URL` (por defecto producción). No corre en CI.
- `tests/parity/` — paridad entre dos builds locales sobre la misma SQLite sembrada (capturas + diff de HTML).
- `.github/workflows/ci.yml` — lint + unit tests una vez; tsc + build por tenant (matriz `yanina`, `vt`) con env ficticias y SQLite local.

## Base de datos (producción: https://yaninacolombero.com, deploy automático desde `main`)

- **Nunca** correr `npm run db:push` / `drizzle-kit push` / `migrate` contra la base de producción.
- Cambios de schema: editar `src/db/schema.ts` → `npm run db:generate` (offline) → commitear el SQL de `drizzle/` → revisión en PR.
- Migraciones de producción solo **aditivas** (columnas nullable o con default, tablas e índices nuevos). Nada de renombrar/borrar en un solo paso.
- `src/lib/auth.ts` — sesión JWT (jose, `iss: pluma`, `aud: <tenant>`) en cookie httpOnly `config.sessionCookie` (`pluma_session` para yanina). Credenciales admin por env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`).
- `src/lib/utils.ts` — hash de IP (SHA-256 + IP_SALT; nunca guardar IPs en crudo), `slugify`, `safeEqual`.
- `src/lib/tags.ts` — helpers seguros para client components (`src/lib/data.ts` es server-only).

## Convenciones

- Server actions en `src/app/admin/actions.ts`, siempre con `requireAuth()` primero.
- Comentarios: estados `pending | approved | rejected`; solo los `approved` se muestran.
- Upvotes: unique index `(articleId, ipHash)`; el cliente usa localStorage para reflejar su propio voto.
- Estilos: Tailwind v4. Estilos compartidos en `src/app/globals.css`; tokens (`paper`, `ink`, `accent`, `accent-soft`, `line`, `muted`, fuentes) en `src/tenants/<tenant>/theme.css`. Títulos con `font-serif` (Lora en yanina).
- Fechas: `Intl.DateTimeFormat(config.locale, …)`, nunca un locale fijo.

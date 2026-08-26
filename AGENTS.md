<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Proyecto: pluma

Plataforma de blog open source para un solo autor. UI en español (es-AR).

## Estructura

- `src/pluma.config.ts` — configuración del sitio y del autor (nombre, bio, links, blacklist de comentarios). Valores por defecto; los textos públicos del autor se pueden sobreescribir desde `/admin/configuracion` (tabla `settings`, ver `src/lib/settings.ts`).
- `src/app/(public)/` — blog público (home, artículo, acerca). Páginas con `force-dynamic` (datos frescos de Turso).
- `src/app/admin/` — panel. `login/` es público; `(panel)/` requiere sesión. Las actions están en `src/app/admin/actions.ts` (cuidado: los route groups cuentan como directorio para los imports relativos).
- `src/app/api/` — `upvote` (toggle anónimo por IP-hash), `comentarios` (crea pendiente de aprobación), `upload` (Vercel Blob, solo admin).
- `src/proxy.ts` — protege `/admin/*` (Next.js 16: `proxy.ts` reemplaza a `middleware.ts`).
- `src/db/` — Drizzle + Turso. Schema push con `npm run db:push` (requiere `.env.local`).
- `src/lib/auth.ts` — sesión JWT (jose) en cookie httpOnly `pluma_session`. Credenciales admin por env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`).
- `src/lib/utils.ts` — hash de IP (SHA-256 + IP_SALT; nunca guardar IPs en crudo), `slugify`, `safeEqual`.
- `src/lib/tags.ts` — helpers seguros para client components (`src/lib/data.ts` es server-only).

## Convenciones

- Server actions en `src/app/admin/actions.ts`, siempre con `requireAuth()` primero.
- Comentarios: estados `pending | approved | rejected`; solo los `approved` se muestran.
- Upvotes: unique index `(articleId, ipHash)`; el cliente usa localStorage para reflejar su propio voto.
- Estilos: Tailwind v4, tokens en `globals.css` (`paper`, `ink`, `accent`, `line`, `muted`), títulos con `font-serif` (Lora).

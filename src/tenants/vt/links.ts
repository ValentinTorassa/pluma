/**
 * Enlaces fijos del sitio de VT Security (footer, Sobre mí, JSON-LD).
 * Vacío = no se muestra.
 *
 * De dónde salió cada uno (2026-09-14). Si cambian, cambian primero allá:
 * - portfolio, youtube, github, linkedin, x, instagram, tiktok y discord:
 *   VT-Knowledge-Engine-Brain, README.md → "Canonical Public Links".
 * - threads: VT-CreatorStack/x-presence-engine/tools/make_story_threads.py
 *   (--handle por defecto) y los permalinks de VT-Content-Data-Lab
 *   data/normalized/threads_uploadpost_posts_2026-09-14.json. Ojo que el handle
 *   NO es el de Instagram: va con guiones bajos.
 * - bluesky: permalinks de VT-Content-Data-Lab
 *   data/normalized/bluesky_public_posts_2026-09-13.json.
 * - apuntesArchive: el archivo público de Apuntes en listmonk (2026-09-29),
 *   VT-Knowledge-Engine-Brain, brand/social-links.md.
 * - book: la página canónica del libro, con el índice completo (2026-10-16).
 *   /libro de este blog apunta su canonical ahí.
 * - labs: el sitio de Open Security Labs (2026-10-17), VT-Knowledge-Engine-Brain,
 *   brand/social-links.md. Antes apuntaba al repo de GitHub, que el sitio ya
 *   enlaza (junto con cómo contribuir).
 * - facebook: la página de VT Security (2026-10-18), VT-Knowledge-Engine-Brain,
 *   brand/social-links.md. Es la página, no el perfil personal de Valen, que no
 *   va en ningún lado.
 * - dev: el perfil de DEV Community (2026-10-19), VT-Knowledge-Engine-Brain,
 *   brand/social-links.md. Ahí salen copias curadas de artículos de este blog,
 *   con el blog como URL canónica.
 */
export const links = {
  domain: "vtsecurity.com.ar",
  portfolio: "https://valentorassa.com/",
  talks: "https://valentorassa.com/charlas",
  orcid: "https://orcid.org/0009-0005-7980-4128",
  youtube: "https://www.youtube.com/@vtcibersecurity",
  github: "https://github.com/ValentinTorassa",
  linkedin: "https://www.linkedin.com/in/valetorassa/",
  x: "https://x.com/ValenSecurity",
  bluesky: "https://bsky.app/profile/vtsecurity.bsky.social",
  threads: "https://www.threads.com/@vt_security_",
  instagram: "https://www.instagram.com/vtsecurity/",
  facebook: "https://www.facebook.com/vtsecurity",
  dev: "https://dev.to/vtsecurity",
  tiktok: "https://www.tiktok.com/@vtsecurity",
  discord: "https://discord.com/invite/z6cr5JF6bJ",
  labs: "https://securitylabs.valentorassa.com/",
  apuntesArchive: "https://news.valentorassa.com/archive",
  book: "https://valentorassa.com/libro",
} as const;

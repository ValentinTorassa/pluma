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
 */
export const links = {
  domain: "vtsecurity.com.ar",
  portfolio: "https://valentorassa.com/",
  youtube: "https://www.youtube.com/@vtcibersecurity",
  github: "https://github.com/ValentinTorassa",
  linkedin: "https://www.linkedin.com/in/valetorassa/",
  x: "https://x.com/ValenSecurity",
  bluesky: "https://bsky.app/profile/vtsecurity.bsky.social",
  threads: "https://www.threads.com/@vt_security_",
  instagram: "https://www.instagram.com/vtsecurity/",
  tiktok: "https://www.tiktok.com/@vtsecurity",
  discord: "https://discord.com/invite/z6cr5JF6bJ",
  labs: "https://github.com/ValentinTorassa/Open-Security-Labs",
} as const;

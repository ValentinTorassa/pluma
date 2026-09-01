import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { config } from "@/pluma.config";

/**
 * Textos públicos editables desde /admin/configuracion.
 * Si no hay override en la DB, se usa el valor de pluma.config.ts.
 */
export type SiteSettings = {
  authorName: string;
  authorRole: string;
  siteDescription: string;
  authorBio: string;
  authorEmail: string;
  authorLinkedin: string;
  authorAvatar: string;
};

export const SETTING_KEYS = [
  "author.name",
  "author.role",
  "site.description",
  "author.bio",
  "author.email",
  "author.linkedin",
  "author.avatar",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const get = (key: SettingKey, fallback: string) => map.get(key) || fallback;

  return {
    authorName: get("author.name", config.author.name),
    authorRole: get("author.role", config.author.role),
    siteDescription: get("site.description", config.siteDescription),
    authorBio: get("author.bio", config.author.bio),
    authorEmail: get("author.email", config.author.email),
    authorLinkedin: get("author.linkedin", config.author.linkedin),
    authorAvatar: get("author.avatar", config.author.avatarUrl),
  };
}

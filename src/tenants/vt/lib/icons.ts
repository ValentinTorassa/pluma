import { parseTags } from "@/lib/tags";
import type { IconName } from "../components/icons";

/**
 * Qué ícono lleva cada artículo, envío o serie, sin campo nuevo en la base.
 *
 * Se parte el slug en palabras (sin tildes, en minúsculas) y gana la PRIMERA
 * regla de la lista que tenga alguna palabra; si el slug no matchea, se
 * prueba con los tags y si tampoco, el ícono por defecto. `palabra*` = prefijo.
 * El orden importa: "docker-y-el-env" es docker, "subiste-el-env-a-github" es env.
 *
 * Contenido de la maqueta → ícono:
 *   subiste-el-env-a-github → env · permisos-chmod-777 → chmod
 *   tu-readme-de-github → readme · docker-y-el-env → docker
 *   uso-linux-todos-los-dias → term · que-es-un-secreto → key
 *   si-empezara-hoy-en-ciberseguridad → map
 *   series: linux-desde-cero → tree · seguridad-en-repos → git · produccion-de-verdad → clock
 */
type Rule = readonly [IconName, readonly string[]];

const ARTICLE_RULES: readonly Rule[] = [
  ["docker", ["docker", "contenedor*", "imagen*", "capa*"]],
  ["env", ["env", "dotenv"]],
  ["chmod", ["chmod", "permiso*"]],
  ["readme", ["readme", "cv", "portfolio"]],
  ["key", ["secreto*", "token*", "key*", "clave*", "credencial*"]],
  ["map", ["empezar*", "mapa*", "carrera*", "roadmap"]],
  ["git", ["git", "github", "repo*", "commit*"]],
  ["clock", ["produccion", "timeout*", "retry*", "retries", "alerta*", "log", "logs"]],
  ["term", ["linux", "shell", "terminal", "bash", "comando*"]],
];
const ARTICLE_FALLBACK: IconName = "term";

const SERIES_RULES: readonly Rule[] = [
  ["tree", ["linux", "archivo*", "sistema*"]],
  ["git", ["repo*", "git", "github"]],
  ["clock", ["produccion", "deploy*", "operacion*"]],
  ["key", ["secreto*", "cripto*"]],
];
const SERIES_FALLBACK: IconName = "tree";

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function match(rules: readonly Rule[], list: string[]): IconName | null {
  for (const [icon, patterns] of rules) {
    const hit = list.some((w) =>
      patterns.some((p) => (p.endsWith("*") ? w.startsWith(p.slice(0, -1)) : w === p)),
    );
    if (hit) return icon;
  }
  return null;
}

/** Artículos y envíos de Apuntes */
export function articleIcon(article: { slug: string; tags: string }): IconName {
  return (
    match(ARTICLE_RULES, words(article.slug)) ??
    match(ARTICLE_RULES, parseTags(article).flatMap(words)) ??
    ARTICLE_FALLBACK
  );
}

export function seriesIcon(series: { slug: string }): IconName {
  return match(SERIES_RULES, words(series.slug)) ?? SERIES_FALLBACK;
}

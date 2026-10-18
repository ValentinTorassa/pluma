import { after } from "next/server";

/**
 * IndexNow (https://www.indexnow.org/documentation): avisa a los buscadores
 * que lo implementan (Bing, Yandex, Seznam, Naver…) que una URL cambió, en
 * lugar de esperar a que vuelvan a pasar.
 *
 * Inerte hasta que exista INDEXNOW_KEY: sin la variable no se sirve el
 * archivo de la clave ni sale ningún pedido. Con la variable:
 * - src/proxy.ts sirve la clave en /<clave>.txt (lo que pide la especificación
 *   para validar que el sitio es nuestro);
 * - al publicar o editar un artículo publicado (admin y /api/v1) se avisa su
 *   URL y la del sitemap, después de responder (`after`): un aviso que falla
 *   no puede romper la publicación.
 *
 * Además hace falta que NEXT_PUBLIC_SITE_URL sea https y, en Vercel, que el
 * deployment sea el de producción: un preview nunca avisa.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

type Env = Record<string, string | undefined>;

/** La clave, si tiene la forma que pide la especificación (8 a 128 letras, números o guiones) */
export function indexNowKey(env: Env = process.env): string | null {
  const key = env.INDEXNOW_KEY?.trim() ?? "";
  return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

/** Contenido de /<clave>.txt, o `null` si el path no es ese (o no hay clave) */
export function indexNowKeyFile(pathname: string, env: Env = process.env): string | null {
  const key = indexNowKey(env);
  return key && pathname === `/${key}.txt` ? key : null;
}

export type IndexNowConfig = { key: string; siteUrl: string };

/** Clave + sitio, o `null` si no corresponde avisar (sin clave, sitio sin https o un preview) */
export function indexNowConfig(env: Env = process.env): IndexNowConfig | null {
  const key = indexNowKey(env);
  if (!key) return null;
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!siteUrl.startsWith("https://")) return null;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return null;
  return { key, siteUrl };
}

/** Cuerpo del POST (https://www.indexnow.org/documentation, "Submitting set of URLs") */
export function indexNowPayload(config: IndexNowConfig, paths: string[]) {
  return {
    host: new URL(config.siteUrl).host,
    key: config.key,
    keyLocation: `${config.siteUrl}/${config.key}.txt`,
    urlList: [...new Set(paths.map((p) => `${config.siteUrl}${p}`))],
  };
}

/** POST a IndexNow. Nunca tira: devuelve si el buscador lo aceptó */
export async function pingIndexNow(
  paths: string[],
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const config = indexNowConfig(env);
  if (!config || paths.length === 0) return false;
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowPayload(config, paths)),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`IndexNow respondió ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn("IndexNow no respondió", err);
    return false;
  }
}

/**
 * Un artículo publicado cambió (se publicó o se editó): avisa sus URLs y el
 * sitemap después de responder. Sin configuración no hace nada, ni agenda nada.
 */
export function notifyIndexNow(paths: string[], env: Env = process.env): void {
  if (!indexNowConfig(env) || paths.length === 0) return;
  after(() => pingIndexNow([...paths, "/sitemap.xml"], env));
}

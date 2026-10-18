import { afterEach, describe, expect, it, vi } from "vitest";

const after = vi.fn();
vi.mock("next/server", () => ({ after }));

const { indexNowConfig, indexNowKey, indexNowKeyFile, indexNowPayload, notifyIndexNow, pingIndexNow } =
  await import("@/lib/indexnow");

const KEY = "0123456789abcdef0123456789abcdef";
const prod = { INDEXNOW_KEY: KEY, NEXT_PUBLIC_SITE_URL: "https://vtsecurity.com.ar" };

describe("IndexNow", () => {
  afterEach(() => {
    after.mockReset();
    vi.unstubAllGlobals();
  });

  it("sin INDEXNOW_KEY no hace nada: ni agenda, ni pide, ni sirve la clave", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const env = { NEXT_PUBLIC_SITE_URL: "https://vtsecurity.com.ar" };

    notifyIndexNow(["/articulo/a"], env);
    expect(after).not.toHaveBeenCalled();
    expect(await pingIndexNow(["/articulo/a"], env)).toBe(false);
    expect(await pingIndexNow(["/articulo/a"], env, fetchSpy)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(indexNowConfig(env)).toBeNull();
    expect(indexNowKeyFile("/undefined.txt", env)).toBeNull();
    expect(indexNowKeyFile("/.txt", env)).toBeNull();
  });

  it("una clave con forma inválida cuenta como ausente", () => {
    for (const key of ["corta", "con espacios adentro", "a/b/c/d/e/f/g", "x".repeat(129)]) {
      expect(indexNowKey({ INDEXNOW_KEY: key })).toBeNull();
    }
    expect(indexNowKey({ INDEXNOW_KEY: ` ${KEY} ` })).toBe(KEY);
  });

  it("no avisa desde un sitio sin https ni desde un preview de Vercel", () => {
    expect(indexNowConfig({ ...prod, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBeNull();
    expect(indexNowConfig({ ...prod, VERCEL_ENV: "preview" })).toBeNull();
    expect(indexNowConfig({ ...prod, VERCEL_ENV: "production" })).toEqual({
      key: KEY,
      siteUrl: "https://vtsecurity.com.ar",
    });
  });

  it("sirve la clave solo en /<clave>.txt", () => {
    expect(indexNowKeyFile(`/${KEY}.txt`, prod)).toBe(KEY);
    expect(indexNowKeyFile(`/${KEY}`, prod)).toBeNull();
    expect(indexNowKeyFile("/otra.txt", prod)).toBeNull();
  });

  it("el aviso lleva host, clave, ubicación de la clave y las URLs absolutas sin repetir", () => {
    expect(indexNowPayload({ key: KEY, siteUrl: "https://vtsecurity.com.ar" }, ["/articulo/a", "/sitemap.xml", "/articulo/a"])).toEqual({
      host: "vtsecurity.com.ar",
      key: KEY,
      keyLocation: `https://vtsecurity.com.ar/${KEY}.txt`,
      urlList: ["https://vtsecurity.com.ar/articulo/a", "https://vtsecurity.com.ar/sitemap.xml"],
    });
  });

  it("con la clave agenda el aviso del artículo y el sitemap después de responder", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);

    notifyIndexNow(["/articulo/a"], prod);
    expect(after).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    await after.mock.calls[0][0]();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(String(init.body)).urlList).toEqual([
      "https://vtsecurity.com.ar/articulo/a",
      "https://vtsecurity.com.ar/sitemap.xml",
    ]);
  });

  it("un aviso que falla no tira", async () => {
    const failing = vi.fn(async () => {
      throw new Error("sin red");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await pingIndexNow(["/articulo/a"], prod, failing)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { signupRef } from "@/lib/newsletter-origin";
import { REF_KEY, rememberRef, sessionStore, signupRefFor } from "@/tenants/vt/lib/session-ref";

/** sessionStorage de mentira: solo lo que usan los helpers */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

/** Como en Safari con el storage bloqueado: cualquier acceso tira */
const throwingStorage = {
  getItem: (): string | null => {
    throw new DOMException("bloqueado", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("lleno", "QuotaExceededError");
  },
};

describe("primer ref de la sesión", () => {
  it("usa la clave con el prefijo del tenant", () => {
    expect(REF_KEY).toBe("vt:ref");
  });

  it("entrar por un artículo con ref y anotarse en /apuntes manda ese ref", () => {
    const storage = memoryStorage();
    rememberRef("?ref=discord", storage); // /articulo/permisos?ref=discord
    rememberRef("", storage); // /apuntes
    expect(signupRefFor("", storage)).toBe("discord");
  });

  it("gana el primero: otro link en la misma sesión no lo pisa", () => {
    const storage = memoryStorage();
    rememberRef("?ref=discord", storage);
    rememberRef("?ref=youtube", storage);
    expect(storage.data.get(REF_KEY)).toBe("discord");
  });

  it("una entrada sin ref no guarda nada, y el primer ref que llega después sí", () => {
    const storage = memoryStorage();
    rememberRef("", storage);
    rememberRef("?utm_source=x", storage);
    rememberRef("?ref=", storage);
    rememberRef("?ref=%20%20", storage);
    expect(storage.data.size).toBe(0);
    rememberRef("?ref=charla-owasp", storage);
    expect(storage.data.get(REF_KEY)).toBe("charla-owasp");
  });

  it("el ref de la URL actual manda sobre el guardado", () => {
    const storage = memoryStorage();
    rememberRef("?ref=discord", storage);
    expect(signupRefFor("?ref=linkedin", storage)).toBe("linkedin");
  });

  it("sin ref en la URL ni guardado es null: el servidor lo cuenta como directo", () => {
    expect(signupRefFor("", memoryStorage())).toBeNull();
    expect(signupRef(signupRefFor("", memoryStorage()))).toBe("directo");
  });

  it("un ref roto se guarda recortado y el servidor lo sigue contando como otro", () => {
    const storage = memoryStorage();
    rememberRef(`?ref=${"a".repeat(500)}`, storage);
    const stored = storage.data.get(REF_KEY) ?? "";
    expect(stored).toHaveLength(64);
    expect(signupRef(signupRefFor("", storage))).toBe("otro");
    expect(signupRef(signupRefFor("?ref=%3Cscript%3E", memoryStorage()))).toBe("otro");
  });

  it("sin sessionStorage o con uno que tira, no rompe y usa solo la URL", () => {
    expect(() => rememberRef("?ref=discord", throwingStorage)).not.toThrow();
    expect(signupRefFor("", throwingStorage)).toBeNull();
    expect(signupRefFor("?ref=discord", throwingStorage)).toBe("discord");
    rememberRef("?ref=discord", null);
    expect(signupRefFor("", null)).toBeNull();
  });

  it("fuera del navegador sessionStore es null en vez de tirar", () => {
    expect(sessionStore()).toBeNull();
    expect(() => rememberRef("?ref=discord")).not.toThrow();
    expect(signupRefFor("")).toBeNull();
  });
});

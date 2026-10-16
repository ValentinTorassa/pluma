import { describe, expect, it } from "vitest";
import { listEnabled, listUuids, newsletterList } from "@/lib/newsletter-lists";

describe("lista de una alta", () => {
  it("sin lista, o apuntes, es Apuntes", () => {
    for (const raw of [undefined, null, "", "apuntes"]) expect(newsletterList(raw)).toBe("apuntes");
  });

  it("libro es la lista de espera del libro", () => {
    expect(newsletterList("libro")).toBe("libro");
  });

  it("cualquier otra cosa no es una lista (la ruta responde 400)", () => {
    for (const raw of ["Libro", "otra", "toString", "__proto__", 1, true, ["libro"], { list: "libro" }]) {
      expect(newsletterList(raw)).toBeNull();
    }
  });
});

describe("UUIDs de cada lista", () => {
  const env = {
    NEWSLETTER_SUBSCRIBE_URL: "https://news.example/api/public/subscription",
    NEWSLETTER_LIST_UUIDS: "uuid-apuntes",
    NEWSLETTER_BOOK_LIST_UUIDS: " uuid-libro-a , uuid-libro-b ,",
  };

  it("cada lista lee su variable, separada por comas y sin vacíos", () => {
    expect(listUuids("apuntes", env)).toEqual(["uuid-apuntes"]);
    expect(listUuids("libro", env)).toEqual(["uuid-libro-a", "uuid-libro-b"]);
    expect(listUuids("libro", {})).toEqual([]);
  });

  it("Apuntes solo necesita el endpoint; el libro además su lista", () => {
    expect(listEnabled("apuntes", env)).toBe(true);
    expect(listEnabled("libro", env)).toBe(true);
    expect(listEnabled("apuntes", { NEWSLETTER_SUBSCRIBE_URL: env.NEWSLETTER_SUBSCRIBE_URL })).toBe(true);
    expect(listEnabled("libro", { ...env, NEWSLETTER_BOOK_LIST_UUIDS: " , " })).toBe(false);
    expect(listEnabled("libro", { ...env, NEWSLETTER_SUBSCRIBE_URL: "" })).toBe(false);
    expect(listEnabled("apuntes", {})).toBe(false);
  });
});

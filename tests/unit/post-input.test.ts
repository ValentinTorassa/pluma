import { describe, expect, it } from "vitest";
import {
  autoExcerpt,
  parseIntField,
  parsePostInput,
  parseSeriesInput,
  type PostInputOptions,
} from "@/lib/post-input";

const full: PostInputOptions = { partial: false, series: true, issues: true };
const patch: PostInputOptions = { ...full, partial: true };

describe("parsePostInput: alta", () => {
  it("normaliza un artículo válido y no inventa campos", () => {
    const result = parsePostInput(
      {
        title: "  Subiste el .env  ",
        slug: "Subiste el .ENV a GitHub",
        content: "## Hola\n\n::figure{name=git-history}",
        tags: ["Git", "secretos", "git", " "],
        coverImage: "https://blob.example.com/vt/x.png",
        status: "published",
        series: "Seguridad en Repos",
        seriesOrder: "2",
        issueNumber: 5,
      },
      full,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Subiste el .env",
        slug: "subiste-el-env-a-github",
        content: "## Hola\n\n::figure{name=git-history}",
        tags: ["git", "secretos"],
        coverImage: "https://blob.example.com/vt/x.png",
        status: "published",
        series: "seguridad-en-repos",
        seriesOrder: 2,
        issueNumber: 5,
      },
    });
  });

  it("exige título y rechaza tipos incorrectos con un código por campo", () => {
    const result = parsePostInput({ content: 3, tags: [1], status: "live", excerpt: null }, full);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "title", code: "required" },
        { field: "content", code: "type" },
        { field: "tags", code: "type" },
        { field: "status", code: "invalid" },
        { field: "excerpt", code: "type" },
      ]),
    );
  });

  it("rechaza campos desconocidos (typos, id, publishedAt)", () => {
    const result = parsePostInput({ title: "x", tittle: "y", publishedAt: "2026-01-01" }, full);
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "tittle", code: "unknown_field" },
        { field: "publishedAt", code: "unknown_field" },
      ],
    });
  });

  it("serie y número de Apuntes solo se aceptan si el tenant tiene la feature", () => {
    const result = parsePostInput({ title: "x", series: "s", seriesOrder: 1, issueNumber: 1 }, {
      partial: false,
      series: false,
      issues: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.field)).toEqual(["series", "seriesOrder", "issueNumber"]);
  });

  it("límites de largo, tags y números", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const result = parsePostInput(
      { title: "x".repeat(201), tags: tooMany, seriesOrder: 0, issueNumber: 1.5, slug: "¡¡¡" },
      full,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "title", code: "too_long" },
        { field: "tags", code: "too_long" },
        { field: "seriesOrder", code: "invalid" },
        { field: "issueNumber", code: "invalid" },
        { field: "slug", code: "invalid" },
      ]),
    );
  });

  it("portada: https o ruta del sitio; nada de javascript:, http ni //host", () => {
    for (const ok of ["https://x.com/a.png", "/images/a.svg"]) {
      expect(parsePostInput({ title: "x", coverImage: ok }, full).ok).toBe(true);
    }
    for (const bad of ["javascript:alert(1)", "http://x.com/a.png", "//evil.com/a.png", "https://x.com/a b"]) {
      expect(parsePostInput({ title: "x", coverImage: bad }, full)).toEqual({
        ok: false,
        errors: [{ field: "coverImage", code: "invalid" }],
      });
    }
    expect(parsePostInput({ title: "x", coverImage: null }, full)).toEqual({
      ok: true,
      value: { title: "x", coverImage: null },
    });
  });

  it("tags como texto separado por comas, igual que el admin", () => {
    expect(parsePostInput({ title: "x", tags: "Linux, permisos,,linux" }, full)).toEqual({
      ok: true,
      value: { title: "x", tags: ["linux", "permisos"] },
    });
  });

  it("el body tiene que ser un objeto", () => {
    for (const body of [null, "x", [], 3]) {
      expect(parsePostInput(body, full)).toEqual({ ok: false, errors: [{ field: "body", code: "type" }] });
    }
  });
});

describe("parsePostInput: edición parcial", () => {
  it("solo devuelve lo que vino; null borra serie, orden y número", () => {
    expect(parsePostInput({ status: "draft", series: null, seriesOrder: null, issueNumber: "" }, patch)).toEqual({
      ok: true,
      value: { status: "draft", series: null, seriesOrder: null, issueNumber: null },
    });
  });

  it("un body vacío es un error, y un título presente no puede quedar vacío", () => {
    expect(parsePostInput({}, patch)).toEqual({ ok: false, errors: [{ field: "body", code: "empty" }] });
    expect(parsePostInput({ title: "   " }, patch)).toEqual({
      ok: false,
      errors: [{ field: "title", code: "required" }],
    });
  });
});

describe("parseSeriesInput", () => {
  it("valida una serie y deja el slug opcional", () => {
    expect(parseSeriesInput({ title: " Linux desde cero ", plannedParts: "5", summary: "" })).toEqual({
      ok: true,
      value: { title: "Linux desde cero", plannedParts: 5, summary: "" },
    });
    expect(parseSeriesInput({ title: "x", plannedParts: "" })).toEqual({
      ok: true,
      value: { title: "x", plannedParts: null },
    });
  });

  it("rechaza título vacío, partes fuera de rango y campos desconocidos", () => {
    expect(parseSeriesInput({ title: "", plannedParts: 100, upcoming: [] })).toEqual({
      ok: false,
      errors: [
        { field: "upcoming", code: "unknown_field" },
        { field: "title", code: "required" },
        { field: "plannedParts", code: "invalid" },
      ],
    });
  });
});

describe("parseIntField y autoExcerpt", () => {
  it("parseIntField acepta enteros en rango, como número o texto", () => {
    expect(parseIntField("3", 10)).toEqual({ ok: true, value: 3 });
    expect(parseIntField(" 7 ", 10)).toEqual({ ok: true, value: 7 });
    expect(parseIntField("", 10)).toEqual({ ok: true, value: null });
    expect(parseIntField(null, 10)).toEqual({ ok: true, value: null });
    for (const bad of ["-1", "1e2", "3.0", 0, 11, 2.5, true, NaN]) {
      expect(parseIntField(bad, 10)).toEqual({ ok: false });
    }
  });

  it("autoExcerpt corta en la última oración antes de 220 caracteres", () => {
    const text = `## Título\n\n${"Una oración bastante larga para la bajada automática. ".repeat(6)}`;
    const excerpt = autoExcerpt(text);
    expect(excerpt.length).toBeLessThanOrEqual(220);
    expect(excerpt.endsWith(".")).toBe(true);
    expect(excerpt).not.toContain("#");
  });
});

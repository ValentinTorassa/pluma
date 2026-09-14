import { describe, expect, it } from "vitest";
import { cubic, drawn, paper, rectPts, rng, sketch } from "@/tenants/vt/figures/ink";
import { articleIcon, seriesIcon } from "@/tenants/vt/lib/icons";

describe("vt: tinta de las figuras", () => {
  it("rng es determinístico por semilla", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it("el mismo dibujo en servidor y cliente", () => {
    expect(drawn(rectPts(0, 0, 40, 30), 7, { fold: 6 })).toEqual(drawn(rectPts(0, 0, 40, 30), 7, { fold: 6 }));
    expect(sketch(rng(3), rectPts(0, 0, 40, 40), true)).toMatch(/^M-?[\d.]+ -?[\d.]+Q/);
  });

  it("paper separa las líneas mayores", () => {
    const g = paper(0, 0, 100, 0, 20);
    expect(g.minor).toBe("M20 0V0M40 0V0M60 0V0M80 0V0");
    expect(g.major).toBe("M0 0V0M100 0V0M0 0H100");
  });

  it("cubic mide y recorre la curva", () => {
    const c = cubic([0, 0], [10, 0], [20, 0], [30, 0]);
    expect(c.length).toBeCloseTo(30, 5);
    expect(c.at(15)[0]).toBeCloseTo(15, 1);
    expect(c.dash).toBeGreaterThanOrEqual(31);
  });
});

describe("vt: íconos por slug y tags", () => {
  const a = (slug: string, tags: string[] = []) => articleIcon({ slug, tags: JSON.stringify(tags) });

  it("mapea el contenido de la maqueta", () => {
    expect(a("subiste-el-env-a-github", ["git", "secretos"])).toBe("env");
    expect(a("permisos-chmod-777", ["linux", "permisos"])).toBe("chmod");
    expect(a("tu-readme-de-github", ["carrera"])).toBe("readme");
    expect(a("docker-y-el-env", ["docker", "secretos"])).toBe("docker");
    expect(a("uso-linux-todos-los-dias", ["linux"])).toBe("term");
    expect(a("que-es-un-secreto", ["secretos"])).toBe("key");
    expect(a("si-empezara-hoy-en-ciberseguridad", ["carrera"])).toBe("map");
    expect(a("quincena-04-docker-capas", ["quincena"])).toBe("docker");
    expect(a("quincena-03-env-readme-chmod", ["quincena"])).toBe("env");
    expect(a("quincena-02-linux", ["quincena"])).toBe("term");
    expect(a("quincena-01-si-empezara-hoy", ["quincena"])).toBe("map");
  });

  it("usa los tags si el slug no dice nada, y si no, el ícono por defecto", () => {
    expect(a("archivos-y-rutas", ["Producción"])).toBe("clock");
    expect(a("algo-nuevo")).toBe("term");
  });

  it("mapea las series", () => {
    expect(seriesIcon({ slug: "linux-desde-cero" })).toBe("tree");
    expect(seriesIcon({ slug: "seguridad-en-repos" })).toBe("git");
    expect(seriesIcon({ slug: "produccion-de-verdad" })).toBe("clock");
  });
});

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
    expect(a("apuntes-04-docker-capas", ["apuntes"])).toBe("docker");
    expect(a("apuntes-03-env-readme-chmod", ["apuntes"])).toBe("env");
    expect(a("apuntes-02-linux", ["apuntes"])).toBe("term");
    expect(a("apuntes-01-si-empezara-hoy", ["apuntes"])).toBe("map");
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

describe("vt: figuras del artículo de puertos", () => {
  it("respawn: kill -9 vuelve con el PID real de la demo; mientras está caído los pedidos rebotan", async () => {
    const { FIRST_PIDS, procAt, simulateRespawn, RS_START } = await import("@/tenants/vt/figures/Respawn");
    expect(procAt([], RS_START)).toMatchObject({ unit: "active", up: true, pid: FIRST_PIDS[0], restarts: 0 });

    const killed = [{ t: 5, action: "kill" as const }];
    expect(procAt(killed, 5.5)).toMatchObject({ up: false, last: "down" });
    expect(procAt(killed, 5.5).relaunch).toBeGreaterThan(0);
    expect(procAt(killed, 7)).toMatchObject({ up: true, pid: FIRST_PIDS[1], restarts: 1, last: "respawned" });
    // lo que llegó al puerto entre la muerte y el relanzamiento no tuvo respuesta
    expect(simulateRespawn(killed, 9).failed).toBeGreaterThan(simulateRespawn([], 9).failed);

    // parar antes de que systemd lo relance: no vuelve solo, y arranca con otro PID
    const stopped = [...killed, { t: 5.4, action: "stop" as const }];
    expect(procAt(stopped, 20)).toMatchObject({ unit: "inactive", up: false, restarts: 0 });
    const started = [...stopped, { t: 21, action: "start" as const }];
    expect(procAt(started, 21.5)).toMatchObject({ unit: "active", up: true, last: "started" });
    expect(procAt(started, 21.5).pid).not.toBe(FIRST_PIDS[0]);
  });

  it("term-vs-kill: TERM termina y guarda todo; KILL corta, pierde y deja el lock", async () => {
    const { simulateKill, TK_START } = await import("@/tenants/vt/figures/TermVsKill");
    expect(simulateKill(null, TK_START)).toEqual(simulateKill(null, TK_START));
    expect(simulateKill(null, TK_START).proc).toBe("alive");

    const term = simulateKill({ kind: "term", t: 6.2 }, 20);
    expect(term).toMatchObject({ proc: "exited", lock: "removed", cut: 0, memory: 0 });
    expect(term.saved).toBe(term.served);
    expect(term.refused).toBeGreaterThan(0);

    const kill = simulateKill({ kind: "kill", t: 6.2 }, 20);
    expect(kill).toMatchObject({ proc: "killed", lock: "stale", stale: true });
    expect(kill.cut).toBeGreaterThan(0);
    // lo que quedó en memoria se perdió: lo guardado es menos que lo atendido
    expect(kill.saved + kill.memory).toBe(kill.served);
  });
});

describe("vt: simulación de bind-scope", () => {
  it("es determinística, y en 127.0.0.1 no sale ningún .env", async () => {
    const { simulate, START_T } = await import("@/tenants/vt/figures/BindScope");
    const { cubic } = await import("@/tenants/vt/figures/ink");
    const G = {
      toBrowser: cubic([150, 90], [262, 90], [288, 188], [316, 188]),
      lan: cubic([316, 188], [376, 188], [372, 100], [432, 100]),
      refused: 26,
      netFrom: [652, 226] as const,
      netTo: [600, 236] as const,
    };
    const open = [{ t: 0, mode: "open" as const }];
    expect(simulate(G, open, START_T)).toEqual(simulate(G, open, START_T));
    // el cuadro inicial ya muestra un .env que salió y pedidos en vuelo
    const first = simulate(G, open, START_T);
    expect(first.leaked).toBeGreaterThan(0);
    expect(first.dots.length).toBeGreaterThan(0);

    // desde que pasa a 127.0.0.1, los pedidos de la red se rechazan y no se cuenta ningún .env
    const local = [...open, { t: 10, mode: "local" as const }];
    const later = simulate(G, local, 40);
    // a lo sumo el que ya había entrado antes del cambio y termina de volver
    expect(later.leaked).toBeLessThanOrEqual(1);
    expect(later.refused).toBeGreaterThan(10);
    expect(later.dots.some((d) => d.kind === "leak")).toBe(false);
    // internet se corta en el router con cualquier dirección
    expect(simulate(G, open, 40).dropped).toBeGreaterThan(5);
  });
});

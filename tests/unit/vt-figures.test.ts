import { describe, expect, it } from "vitest";
import { cubic, drawn, paper, rectPts, rng, sketch } from "@/tenants/vt/figures/ink";
import type { Preset } from "@/tenants/vt/figures/EgressTripwire";
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
    expect(a("gitops-desplego-lo-que-decia-git", ["gitops", "kubernetes"])).toBe("git");
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

describe("vt: figuras del webhook duplicado", () => {
  it("webhook-retry: el ingenuo acredita dos veces; el que anota antes descarta el reintento", async () => {
    const { simulateRetry, RT_START, RT_END, AMOUNT } = await import("@/tenants/vt/figures/WebhookRetry");
    expect(simulateRetry("naive", RT_START)).toEqual(simulateRetry("naive", RT_START));
    // el cuadro inicial: la primera entrega en camino y nada acreditado
    expect(simulateRetry("naive", RT_START)).toMatchObject({ deliveries: 0, credited: 0, phase: "sending" });
    expect(simulateRetry("naive", RT_START).dots).toHaveLength(1);

    const naive = simulateRetry("naive", RT_END);
    expect(naive).toMatchObject({ deliveries: 2, credited: 2 * AMOUNT, ledgerRows: 2, dupes: 0, provider: "delivered" });
    const hardened = simulateRetry("hardened", RT_END);
    expect(hardened).toMatchObject({ deliveries: 2, credited: AMOUNT, ledgerRows: 1, dupes: 1, processed: true, receiver: "duplicate" });

    // en el medio, el proveedor se queda sin respuesta y reintenta
    const phases = new Set(Array.from({ length: 70 }, (_, i) => simulateRetry("naive", i / 10).phase));
    expect([...phases]).toEqual(["sending", "applied", "lost", "retry", "done"]);
  });

  it("webhook-race: buscar y después anotar deja $ 37.000; anotar primero, $ 18.500", async () => {
    const { raceAt, RACE_STEPS } = await import("@/tenants/vt/figures/WebhookRace");
    const last = RACE_STEPS - 1;
    expect(raceAt("check", 0)).toMatchObject({ credited: 0, window: false });
    expect(raceAt("check", last)).toMatchObject({ credited: 37000, rows: 2, window: true });
    expect(raceAt("unique", last)).toMatchObject({ credited: 18500, rows: 1, window: false });
    // el tiempo solo avanza
    for (const mode of ["check", "unique"] as const) {
      const ends = Array.from({ length: RACE_STEPS }, (_, i) => raceAt(mode, i).end);
      expect(ends).toEqual([...ends].sort((a, b) => a - b));
    }
  });

  it("webhook-order: gana el último termina paid con $ 0; la tabla, refunded como el proveedor", async () => {
    const { orderAt, ORDER_STEPS, AMOUNT } = await import("@/tenants/vt/figures/WebhookOrder");
    const last = ORDER_STEPS - 1;
    expect(orderAt("last", 0)).toMatchObject({ state: "refunded", credited: -AMOUNT, skip: "taken" });
    expect(orderAt("last", last)).toMatchObject({ state: "paid", credited: 0, match: false });
    expect(orderAt("table", 0)).toMatchObject({ state: "created", credited: 0, deadLetter: true, codes: [409, null, null] });
    expect(orderAt("table", 1)).toMatchObject({ state: "paid", credited: AMOUNT });
    expect(orderAt("table", last)).toMatchObject({ state: "refunded", credited: 0, match: true, codes: [409, 200, 200] });
  });

  it("webhook-recon: 5 / 1 / 0 diferencias y $ 115.500 / $ 18.500 / $ 0, como el laboratorio", async () => {
    const { reconcile } = await import("@/tenants/vt/figures/WebhookRecon");
    expect(reconcile("naive")).toEqual({ tested: 5, diffs: 5, over: 115500 });
    expect(reconcile("check")).toEqual({ tested: 2, diffs: 1, over: 18500 });
    expect(reconcile("hardened")).toEqual({ tested: 5, diffs: 0, over: 0 });
  });

  it("los pesos llevan punto de miles", async () => {
    const { pesos } = await import("@/tenants/vt/figures/WebhookRetry");
    expect(pesos(115500)).toBe("$ 115.500");
    expect(pesos(0)).toBe("$ 0");
    expect(pesos(-12750)).toBe("−$ 12.750");
  });
});

describe("vt: figuras del artículo del firewall para agentes", () => {
  it("allowlist-egress: en 0.3.0 llegan las tres con la key; en 0.4.0 secret-egress frena las dos con la key y sh-paths la de @.env", async () => {
    const { AE_END, AE_START, REQUESTS, simulateEgress } = await import("@/tenants/vt/figures/AllowlistEgress");
    const { copy } = await import("@/tenants/vt/messages");
    const m = copy.figures.allowlistEgress;
    // las decisiones del hook: 0.3.0 deja pasar todo; en 0.4.0, sh-paths la de @.env y secret-egress las otras dos
    expect(REQUESTS.map((r) => r.stop)).toEqual([
      { v03: null, v04: "sh-paths" },
      { v03: null, v04: "secret-egress" },
      { v03: null, v04: "secret-egress" },
    ]);
    // la etiqueta es herramienta + destino: las tres a docs.python.org, y solo la primera nombra @.env
    expect(m.tags.map(([, dest]) => dest)).toEqual(["docs.python.org", "docs.python.org", "docs.python.org"]);
    expect(m.tags.map(([tool]) => tool.includes(m.pathArg))).toEqual([true, false, false]);

    // el cuadro inicial es 0.3.0 terminado: las tres abiertas en el buzón, con la key adentro
    expect(simulateEgress("v03", AE_START)).toMatchObject({ arrived: [0, 1, 2], withKey: [0, 1, 2], refused: [], done: true });

    const fixed = simulateEgress("v04", AE_END.v04);
    expect(fixed).toMatchObject({ arrived: [], withKey: [], refused: [0, 1, 2], done: true });
    expect(fixed.parcels.map((p) => p.rule)).toEqual(["sh-paths", "secret-egress", "secret-egress"]);
    expect(fixed.parcels.every((p) => p.to === "rejected" && p.p === 1)).toBe(true);

    for (let t = 0; t <= AE_END.v04; t += 0.05) {
      const old = simulateEgress("v03", Math.min(t, AE_END.v03));
      const now = simulateEgress("v04", t);
      // en 0.3.0 no hay escáner ni rechazo, y la barrera nunca sube en 0.4.0
      expect(old.beam || old.refused.length > 0 || old.parcels.some((p) => p.reveal > 0 && p.to !== "inbox")).toBe(false);
      expect(now.arm).toBe(0);
      expect(now.arrived).toEqual([]);
      // el escáner no ve la key en la de @.env: cuando la sella sh-paths, ya se ve de nuevo la etiqueta
      if (now.parcels[0].rule) expect(now.parcels[0].inside).toBe(0);
      // un paquete a la vez frente al control
      expect(now.parcels.filter((p) => p.to === "stop" && p.p === 1 && p.opacity > 0).length).toBeLessThanOrEqual(1);
    }
  });

  it("allowlist-egress (home): la mini termina en la respuesta del artículo", async () => {
    const { MINI_END, miniAt } = await import("@/tenants/vt/figures/MiniEgress");
    expect(miniAt(MINI_END)).toMatchObject({ v04: true, arm: 0, pf: { rule: "secret-egress", to: "stop", inside: 1, reveal: 1 } });
    // en la primera pasada (0.3.0) llega al buzón y recién ahí se ve la key
    expect(miniAt(3)).toMatchObject({ v04: false, pf: { to: "inbox", p: 1, inside: 1, rule: null } });
  });

  it("self-disable: 0.3.0 crea el archivo y la sesión siguiente arranca sin hook; 0.4.0 rechaza las dos llamadas", async () => {
    const { SD_END, simulateSelfDisable } = await import("@/tenants/vt/figures/SelfDisable");
    // el cuadro inicial es el final de 0.3.0: Write pasó, la sesión N+1 arrancó sin hook y Read .env llegó
    expect(simulateSelfDisable("v03", SD_END.v03)).toMatchObject({
      settings: "written",
      hookNext: "off",
      decisions: { write: "allow", read: null },
      envRead: true,
      done: true,
    });
    // 0.4.0: fs-protected para Write .claude/settings.local.json y para Read .env; el hook sigue cargado
    expect(simulateSelfDisable("v04", SD_END.v04)).toMatchObject({
      settings: "absent",
      hookNext: "on",
      decisions: { write: "fs", read: "fs" },
      envRead: false,
      done: true,
    });

    // el orden de la historia: el muro se borra recién después de que el host lee el archivo,
    // y el agente lee el .env recién con el muro borrado
    for (let t = 0; t <= SD_END.v03; t += 0.05) {
      const f = simulateSelfDisable("v03", t);
      if (f.erase > 0) expect(f.host).toBe(1);
      if (f.read > 0) expect(f.erase).toBe(1);
      if (f.hookNext === "off") expect(f.settings).toBe("written");
    }
    // en 0.4.0 nunca se crea el archivo, nunca se borra el muro y el .env nunca se lee
    for (let t = 0; t <= SD_END.v04; t += 0.05) {
      const f = simulateSelfDisable("v04", t);
      expect(f).toMatchObject({ settings: "absent", erase: 0, envRead: false, open: 0 });
      expect(f.hookNext).not.toBe("off");
    }
  });

  it("egress-tripwire: reconoce tal cual, %XX, base64 y hex, como agent_firewall/egress.py; en dos, al revés o cifrada pasa", async () => {
    const { detect, request, spellings } = await import("@/tenants/vt/figures/EgressTripwire");
    const value = "sk_test_51Synthetic";
    // las mismas formas que spellings() de agent_firewall/egress.py para este valor
    expect(spellings(value).map((s) => s.text).sort()).toEqual(
      [
        "736b5f746573745f353153796e746865746963",
        "736B5F746573745F353153796E746865746963",
        "c2tfdGVzdF81MVN5bnRoZXRpY",
        "za190ZXN0XzUxU3ludGhldGlj",
        "NrX3Rlc3RfNTFTeW50aGV0aW",
        "sk_test_51Synthetic",
      ].sort(),
    );
    const host = "https://docs.python.org/3/search.html";
    const found = (p: Preset) => request(p, value, host).match;
    expect(found("plain")).toMatchObject({ form: "plain", decoded: false });
    expect(found("percent")).toMatchObject({ form: "plain", decoded: true });
    expect(found("base64")).toMatchObject({ form: "base64", decoded: false });
    expect(found("hex")).toMatchObject({ form: "hex", decoded: false });
    expect(found("split")).toBeNull();
    expect(found("reverse")).toBeNull();
    expect(found("xor")).toBeNull();
    // la coincidencia cae sobre el valor dentro de la URL
    const plain = request("plain", value, host);
    const at = plain.match!;
    expect(`${host}${plain.query}`.slice(at.start, at.end)).toBe(value);
    // un base64 desalineado (otro prefijo) también se encuentra
    expect(detect(btoa(`ab${value}`), value)).toMatchObject({ form: "base64" });
    expect(detect(btoa(`a${value}`), value)).toMatchObject({ form: "base64" });
  });

  it("egress-tripwire: las fichas muestran lo que sale y solo lo reconocido toca el cable", async () => {
    const { endOf, look, PRESETS, SLOTS, START, tripwireAt } = await import("@/tenants/vt/figures/EgressTripwire");
    const value = "sk_test_51Synthetic";
    expect(SLOTS).toBe(value.length);
    // tal cual es la key; al revés, las mismas letras al revés; en dos, dos grupos con &r= en el medio
    expect(look("plain", value, SLOTS)).toMatchObject({ prefix: "?q=", gap: null, more: false });
    expect(look("plain", value, SLOTS).chars.join("")).toBe(value);
    expect(look("reverse", value, SLOTS).chars.join("")).toBe([...value].reverse().join(""));
    const split = look("split", value, SLOTS);
    expect(split).toMatchObject({ gap: 13, gapText: "&r=", more: false });
    expect(split.chars.join("")).toBe(value);
    // las codificaciones largas se recortan en la última ficha
    const hex = look("hex", value, SLOTS);
    expect(hex.more).toBe(true);
    expect(hex.chars).toHaveLength(SLOTS);
    expect(hex.chars.join("")).toBe("736b5f746573745f35…");
    expect(look("percent", value, SLOTS).chars.join("")).toBe("%73%6B%5F%74%65%73…");

    // el cuadro inicial ya muestra la key frenada en el cable, y es determinístico
    expect(tripwireAt(START, endOf(START))).toEqual(tripwireAt(START, endOf(START)));
    expect(tripwireAt(START, endOf(START)).row.outcome).toBe("caught");

    for (const narrow of [false, true]) {
      const caughtY = tripwireAt("plain", endOf("plain"), null, narrow).row.tiles[0].y;
      for (const p of PRESETS) {
        const caught = ["plain", "percent", "base64", "hex"].includes(p);
        const end = tripwireAt(p, endOf(p), null, narrow);
        expect(end.row.outcome).toBe(caught ? "caught" : "passed");
        expect(end.row.verdict).toBe(1);
        expect(end.row.tiles.map((t) => t.ch)).toEqual(look(p, value, SLOTS).chars);
        expect(end.row.tiles.every((t) => t.sy === 1)).toBe(true);
        // la campana ya se quedó quieta
        expect(Math.abs(end.bell)).toBeLessThan(1);
        if (caught) expect(end.bend).toBeGreaterThan(5);
        else {
          // lo que pasa queda abajo del cable, en el buscador, todo a la misma altura
          expect(end.row.tiles.every((t) => t.y === end.row.tiles[0].y)).toBe(true);
          expect(end.row.tiles[0].y).toBeGreaterThan(caughtY + 40);
          // y el cable nunca se mueve
          for (let t = 0; t <= endOf(p); t += 0.05) {
            const f = tripwireAt(p, t, null, narrow);
            expect(f.bend).toBe(0);
            expect(f.bell).toBe(0);
          }
        }
      }
    }

    // a mitad del disfraz hay fichas dándose vuelta; tal cual y en dos no se dan vuelta nunca
    const flipping = (p: Preset) => [0.5, 0.7, 0.9, 1.1].some((t) => tripwireAt(p, t).row.tiles.some((tile) => tile.sy < 0.5));
    for (const p of ["percent", "base64", "hex", "reverse", "xor"] as const) expect(flipping(p)).toBe(true);
    expect(flipping("plain") || flipping("split")).toBe(false);
    // en dos se separa: entre la ficha 13 y la 12 queda el hueco del &r=
    const open = tripwireAt("split", endOf("split")).row.tiles;
    const closed = tripwireAt("split", 0.3).row.tiles;
    expect(open[13].x - open[12].x).toBeGreaterThan(closed[13].x - closed[12].x + 20);

    // al elegir otra, la anterior se apaga y el cable hundido vuelve
    const from = { preset: START, t: endOf(START) };
    expect(tripwireAt("split", 0.05, from).ghost).not.toBeNull();
    expect(tripwireAt("split", 0.4, from).ghost).toBeNull();
    expect(Math.abs(tripwireAt("split", 1.2, from).bend)).toBeLessThan(0.1);
  });
});

describe("vt: figuras del artículo de JWT", () => {
  const decode = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

  it("jwt-firma: el token de ejemplo es HS256 y los dos payloads solo cambian el rol", async () => {
    const { HEADER, PAYLOAD, SIGNATURE, COMPUTED, DIFF } = await import("@/tenants/vt/figures/JwtFirma");
    expect(decode(HEADER)).toEqual({ alg: "HS256", typ: "JWT" });
    const user = decode(PAYLOAD.user);
    const admin = decode(PAYLOAD.admin);
    expect(user).toEqual({ sub: "user-123", name: "Ana", role: "user", iat: 1795176000, exp: 1795176900 });
    expect(admin).toEqual({ ...user, role: "admin" });
    // la firma del token es la que calcula el servidor para el payload original, no para el cambiado
    expect(COMPUTED.user).toBe(SIGNATURE);
    expect(COMPUTED.admin).not.toBe(SIGNATURE);
    expect(SIGNATURE).toMatch(/^[\w-]{43}$/);
    expect(COMPUTED.admin).toMatch(/^[\w-]{43}$/);
    // hasta DIFF los dos payloads coinciden en base64url
    expect(PAYLOAD.user.slice(0, DIFF)).toBe(PAYLOAD.admin.slice(0, DIFF));
    expect(PAYLOAD.user[DIFF]).not.toBe(PAYLOAD.admin[DIFF]);
  });

  it("jwt-firma: el original se acepta; con el rol cambiado la firma no coincide y se rechaza", async () => {
    const { simulateFirma, FS_START, FS_END, PAYLOAD, DIFF, SHOW } = await import("@/tenants/vt/figures/JwtFirma");
    // el cuadro inicial: el token original en camino, nada comparado todavía
    expect(simulateFirma("user", FS_START)).toEqual(simulateFirma("user", FS_START));
    expect(simulateFirma("user", FS_START)).toMatchObject({
      payload: PAYLOAD.user,
      changed: [],
      caret: null,
      role: "user",
      received: false,
      computed: 0,
      verdict: 0,
      server: "waiting",
      phase: "sending",
    });
    expect(simulateFirma("user", FS_START).dot).toBeGreaterThan(0);

    expect(simulateFirma("user", FS_END)).toMatchObject({ match: true, server: "accepted", verdict: 1, computed: SHOW, dot: null });
    const admin = simulateFirma("admin", FS_END, "user");
    expect(admin).toMatchObject({ payload: PAYLOAD.admin, role: "admin", match: false, server: "rejected", verdict: 1 });
    // lo resaltado es justo lo que ya no es el payload firmado
    expect(admin.changed).toEqual([[DIFF, PAYLOAD.admin.length]]);

    // el orden de la historia, y el payload se reescribe de a poco
    const steps = Array.from({ length: Math.ceil(FS_END * 20) + 1 }, (_, i) => simulateFirma("admin", i / 20, "user"));
    expect([...new Set(steps.map((f) => f.phase))]).toEqual(["edit", "sending", "checking", "done"]);
    const lengths = new Set(steps.filter((f) => f.caret !== null).map((f) => f.changed[0]?.[1] ?? DIFF));
    expect(lengths.size).toBeGreaterThan(10);
    // cada cuadro es una mezcla: lo nuevo adelante, lo viejo atrás
    for (const f of steps) {
      expect(f.payload.slice(0, DIFF)).toBe(PAYLOAD.user.slice(0, DIFF));
      expect(PAYLOAD.admin.startsWith(f.payload.slice(0, f.changed[0]?.[1] ?? DIFF))).toBe(true);
    }

    // de vuelta al original: lo que era del payload cambiado se va, y se acepta otra vez
    const back = simulateFirma("user", FS_END, "admin");
    expect(back).toMatchObject({ payload: PAYLOAD.user, changed: [], match: true, server: "accepted" });
    expect(simulateFirma("user", 0.8, "admin").changed.length).toBe(1);
  });

  it("jwt-firma: la firma queda en el mismo renglón, igual, con los dos payloads", async () => {
    const { tokenRows, HEADER, PAYLOAD, SIGNATURE, DIFF } = await import("@/tenants/vt/figures/JwtFirma");
    const user = tokenRows(PAYLOAD.user, [], 44);
    const admin = tokenRows(PAYLOAD.admin, [[DIFF, PAYLOAD.admin.length]], 44);
    const text = (rows: typeof user) => rows.map((r) => r.map((run) => run.text).join("")).join("");
    expect(text(user)).toBe(`${HEADER}.${PAYLOAD.user}.${SIGNATURE}`);
    expect(text(admin)).toBe(`${HEADER}.${PAYLOAD.admin}.${SIGNATURE}`);
    expect(user).toHaveLength(admin.length);
    expect(user.at(-1)).toEqual([{ cls: "s", text: SIGNATURE, col: 0 }]);
    expect(admin.at(-1)).toEqual(user.at(-1));
    for (const row of [...user, ...admin]) expect(row.reduce((n, run) => n + run.text.length, 0)).toBeLessThanOrEqual(44);
    // el original no tiene nada resaltado; el cambiado, desde DIFF hasta el punto
    expect(user.flat().some((run) => run.cls === "pc")).toBe(false);
    expect(admin.flat().filter((run) => run.cls === "pc").reduce((n, run) => n + run.text.length, 0)).toBe(PAYLOAD.admin.length - DIFF);
  });

  it("jwt-checks: con todo prendido llega solo el correcto, y cada uno lo frena su control", async () => {
    const { ALL_ON, CK_START, TOKENS, checksEnd, schedule, simulateChecks } = await import("@/tenants/vt/figures/JwtChecks");
    const { copy } = await import("@/tenants/vt/messages");
    const m = copy.figures.jwtChecks;
    // los códigos que devolvió jose 6.1.0 en la demo
    expect(TOKENS.map((t) => [t.id, t.stop, t.id === "ok" ? null : m.codes[t.id]])).toEqual([
      ["ok", null, null],
      ["role", "sig", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"],
      ["expired", "exp", "ERR_JWT_EXPIRED"],
      ["aud", "aud", "ERR_JWT_CLAIM_VALIDATION_FAILED"],
      ["none", "alg", "ERR_JOSE_ALG_NOT_ALLOWED"],
      ["noexp", "exp", "ERR_JWT_CLAIM_VALIDATION_FAILED"],
    ]);

    // el cuadro inicial: el correcto ya llegó y la firma acaba de frenar al de rol cambiado
    const first = simulateChecks(ALL_ON, CK_START);
    expect(first).toEqual(simulateChecks(ALL_ON, CK_START));
    expect(first.queue).toEqual(["arrived", "caught", "waiting", "waiting", "waiting", "waiting"]);
    expect(first.code).toMatchObject({ index: 1, check: "sig" });
    expect(first.arrived).toHaveLength(1);

    const end = simulateChecks(ALL_ON, checksEnd(ALL_ON));
    expect(end).toMatchObject({ stopped: 5, done: true, code: null, moving: null });
    expect(end.arrived.map((r) => [r.index, r.intrusion])).toEqual([[0, false]]);
    expect(schedule(ALL_ON).map((t) => t.outcome)).toEqual(["arrived", "caught", "caught", "caught", "caught", "caught"]);

    // de a uno: nunca hay dos tokens en camino
    for (let t = 0; t <= checksEnd(ALL_ON); t += 0.05) {
      expect(simulateChecks(ALL_ON, t).queue.filter((q) => q === "active").length).toBeLessThanOrEqual(1);
    }
  });

  it("jwt-checks: apagar un control deja entrar justo a los tokens que frenaba", async () => {
    const { ALL_ON, CHECKS, TOKENS, checksEnd, simulateChecks } = await import("@/tenants/vt/figures/JwtChecks");
    const entered = (off: (typeof CHECKS)[number][]) => {
      const on = { ...ALL_ON };
      for (const k of off) on[k] = false;
      const f = simulateChecks(on, checksEnd(on));
      return f.arrived.filter((r) => r.intrusion).map((r) => TOKENS[r.index].id);
    };
    expect(entered(["alg"])).toEqual(["none"]);
    expect(entered(["sig"])).toEqual(["role"]);
    expect(entered(["exp"])).toEqual(["expired", "noexp"]);
    expect(entered(["aud"])).toEqual(["aud"]);
    expect(entered([...CHECKS])).toEqual(["role", "expired", "aud", "none", "noexp"]);

    // el que entra se marca recién al pasar por su control apagado
    const on = { ...ALL_ON, sig: false };
    const marks = Array.from({ length: 200 }, (_, i) => simulateChecks(on, i / 20).moving).filter((mv) => mv?.index === 1);
    expect(marks.some((mv) => !mv!.breached)).toBe(true);
    expect(marks.some((mv) => mv!.breached)).toBe(true);
    const all = simulateChecks({ alg: false, sig: false, exp: false, aud: false }, 100);
    expect(all).toMatchObject({ stopped: 0, done: true });
    expect(all.arrived).toHaveLength(6);
  });
});

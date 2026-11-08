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

describe("vt: figuras del artículo del 502", () => {
  it("las dos figuras están registradas, anchas, con su descripción y su pie", async () => {
    const { FIGURES, isFigureName } = await import("@/tenants/vt/figures/registry");
    for (const name of ["request-capas", "request-502"] as const) {
      expect(isFigureName(name)).toBe(true);
      expect(FIGURES[name]).toMatchObject({ wide: true });
      expect(FIGURES[name].label.length).toBeGreaterThan(200);
      expect(FIGURES[name].caption).toBeTruthy();
    }
  });

  it("request-capas: cada corrida muere en su capa y solo escriben los logs que se enteraron", async () => {
    const { CAPAS_START, MODES, REFUSED_AT, capasEnd, simulateCapas } = await import("@/tenants/vt/figures/RequestCapas");
    type Mode = (typeof MODES)[number];
    const end = (mode: Mode) => simulateCapas(mode, capasEnd(mode));
    const none = { access: "none", error: "none", app: "none" };

    // el cuadro inicial es la corrida sana, terminada
    expect(simulateCapas("sano", CAPAS_START)).toEqual(simulateCapas("sano", CAPAS_START));
    expect(simulateCapas("sano", CAPAS_START)).toEqual(end("sano"));

    expect(end("sano")).toMatchObject({ reach: 4, dead: null, fault: null, dot: null, curl: true, done: true });
    expect(end("sano").logs).toEqual({ access: "line", error: "none", app: "line" });
    // DNS y TLS: la request muere antes de ser HTTP y ningún log se entera
    expect(end("dns")).toMatchObject({ reach: 1, veer: 1, dead: "dns", fault: "dns", curl: true, done: true });
    expect(end("dns").logs).toEqual(none);
    expect(end("tls")).toMatchObject({ reach: 2, veer: 0, dead: "tls", fault: "tls", dot: null, done: true });
    expect(end("tls").logs).toEqual(none);
    // los dos 502: Nginx no llega a la app y escribe él; la causa está en el proxy o en la app
    for (const mode of ["proxy", "bind"] as const) {
      expect(end(mode)).toMatchObject({ reach: REFUSED_AT, dead: "upstream", dot: null, done: true });
      expect(end(mode).logs).toEqual({ access: "line", error: "line", app: "none" });
    }
    expect(end("proxy").fault).toBe("proxy");
    expect(end("bind").fault).toBe("app");

    for (const mode of MODES) {
      const last = end(mode);
      let curl = false;
      for (let t = 0; t <= capasEnd(mode); t += 0.02) {
        const f = simulateCapas(mode, t);
        // nunca pasa de donde muere; la respuesta vuelve por el mismo camino
        expect(f.reach).toBeLessThanOrEqual(last.reach + 1e-9);
        if (f.dot?.on === "track") expect(f.dot.s).toBeLessThanOrEqual(f.reach + 1e-9);
        if (f.dot?.on === "veer") expect(mode).toBe("dns");
        // la causa se marca recién cuando la request llega a esa capa
        if (f.fault) expect(f.dead !== null || mode === "dns").toBe(true);
        // mientras curl espera, ningún log se da por vacío
        if (!f.curl) expect(Object.values(f.logs)).not.toContain("none");
        curl ||= f.curl;
      }
      expect(curl).toBe(true);
    }

    // el orden: la app escribe al atender y Nginx cuando sale la respuesta; en el 502, primero el error
    const firstLine = (mode: Mode, id: "access" | "error" | "app") => {
      for (let t = 0; t <= capasEnd(mode); t += 0.01) if (simulateCapas(mode, t).logs[id] === "line") return t;
      return Infinity;
    };
    expect(firstLine("sano", "app")).toBeLessThan(firstLine("sano", "access"));
    expect(firstLine("proxy", "error")).toBeLessThan(firstLine("proxy", "access"));
    // DNS: curl espera al servidor viejo antes de cortar
    const waiting = Array.from({ length: 100 }, (_, i) => simulateCapas("dns", (i / 100) * capasEnd("dns")).wait).filter((w) => w !== null);
    expect(waiting.length).toBeGreaterThan(10);
    expect(Math.max(...(waiting as number[]))).toBeLessThanOrEqual(1);
  });

  it("request-capas: lo que muestra cada corrida es la salida del lab", async () => {
    const { CAUSE, LOGS, MODES, capasEnd, simulateCapas } = await import("@/tenants/vt/figures/RequestCapas");
    const { copy } = await import("@/tenants/vt/messages");
    const m = copy.figures.requestCapas;
    // una fila tiene línea justo cuando el lab la escribió
    for (const mode of MODES) {
      const f = simulateCapas(mode, capasEnd(mode));
      for (const id of LOGS) expect([mode, id, f.logs[id] === "line"]).toEqual([mode, id, m.output[mode].logs[id] !== null]);
    }
    // sano: el mismo id en el proxy y en la app
    const sano = m.output.sano;
    expect(sano.curl).toBe("HTTP/1.1 200 OK");
    expect(sano.logs.access).toBe(`proxy rid=${sano.rid} "GET /api/hola HTTP/1.1" status=200 upstream=172.18.0.2:3000`);
    expect(sano.logs.app).toBe(`app rid=${sano.rid} "GET /api/hola" status=200 cliente=172.18.0.1`);
    // DNS y TLS: el error lo da curl
    expect(m.output.dns.curl).toBe("curl: (28) Connection timed out after 3002 milliseconds");
    expect(m.output.tls.curl).toBe("curl: (60) SSL: no alternative certificate subject name matches target hostname 'api.demo.test'");
    // los dos 502: la misma respuesta y el mismo error; cambia el puerto de upstream
    for (const [mode, port] of [
      ["proxy", 8000],
      ["bind", 3000],
    ] as const) {
      const out = m.output[mode];
      expect(out.curl).toBe("HTTP/1.1 502 Bad Gateway");
      expect(out.logs.access).toBe(`proxy rid=${out.rid} "GET /api/hola HTTP/1.1" status=502 upstream=172.18.0.2:${port}`);
      expect(out.logs.error).toBe(
        `connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://172.18.0.2:${port}/api/hola"`,
      );
    }
    expect(m.output.proxy.rid).not.toBe(m.output.bind.rid);
    // la capa con la causa muestra el valor roto de esa corrida
    expect(CAUSE).toEqual({ sano: null, dns: "dns", tls: "tls", proxy: "proxy", bind: "app" });
    expect(m.values.dns).toEqual({ ok: "127.0.0.1", bad: "203.0.113.50" });
    expect(m.values.tls).toEqual({ ok: "api.demo.test", bad: "www.demo.test" });
    expect(m.values.proxy).toEqual({ ok: "http://app:3000", bad: "http://app:8000" });
    expect(m.values.app).toEqual({ ok: "0.0.0.0:3000", bad: "127.0.0.1:3000" });
  });

  it("request-502: Nginx no llega a la app en los dos casos; la prueba a app:3000 los separa", async () => {
    const { CASES, UPSTREAM, answers, probeAnswers, refused } = await import("@/tenants/vt/figures/Request502");
    expect(UPSTREAM).toEqual({ port: 8000, bind: 3000 });
    expect(CASES.map(refused)).toEqual([true, true]);
    expect(CASES.map(probeAnswers)).toEqual([true, false]);
    // en el segundo, la app contesta en el 3000, pero solo adentro de su contenedor
    expect(answers("bind", 3000, "lo")).toBe(true);
    expect(answers("bind", 3000, "eth")).toBe(false);
    expect(answers("port", 8000, "eth")).toBe(false);
  });

  it("request-502: lo igual va una vez y lo distinto aparece de a una fila por paso", async () => {
    const { STEPS, diffAt, plain } = await import("@/tenants/vt/figures/Request502");
    const { copy } = await import("@/tenants/vt/messages");
    const m = copy.figures.request502;
    const capas = copy.figures.requestCapas.output;
    expect(STEPS).toBe(5);
    expect(m.steps).toHaveLength(STEPS);
    expect(diffAt(0)).toEqual({ rows: 0, port: false, proxyPass: false, listen: false, probe: false });
    expect(diffAt(STEPS - 1)).toEqual({ rows: 4, port: true, proxyPass: true, listen: true, probe: true });
    expect(diffAt(99)).toEqual(diffAt(STEPS - 1));
    for (let k = 1; k < STEPS; k++) expect(diffAt(k).rows).toBe(diffAt(k - 1).rows + 1);

    // lo igual es igual en las dos salidas del lab
    expect(m.sameRows[0].lines).toEqual(["HTTP/1.1 502 Bad Gateway", "Server: nginx"]);
    for (const out of [capas.proxy, capas.bind]) {
      expect(out.curl).toBe(m.sameRows[0].lines[0]);
      expect(out.logs.error?.startsWith(m.sameRows[1].lines[0])).toBe(true);
    }
    // lo distinto, sin las marcas, es lo que salió en cada falla
    expect(m.diffRows.map((r) => [plain(r.port), plain(r.bind)])).toEqual([
      ['upstream: "http://172.18.0.2:8000/api/hola"', 'upstream: "http://172.18.0.2:3000/api/hola"'],
      ["proxy_pass http://app:8000;", "proxy_pass http://app:3000;"],
      ["app escuchando en 0.0.0.0:3000", "app escuchando en 127.0.0.1:3000"],
      [
        "[OK] APP … contesta desde la red interna (app:3000)",
        "[FALLA] APP … desde el proxy: can't connect to remote host (172.18.0.2): Connection refused",
      ],
    ]);
    // el upstream es el final de la misma línea del error.log que muestra la otra figura
    expect(capas.proxy.logs.error?.endsWith(plain(m.diffRows[0].port))).toBe(true);
    expect(capas.bind.logs.error?.endsWith(plain(m.diffRows[0].bind))).toBe(true);
    // cada fila marca algo en las dos columnas
    for (const r of m.diffRows) for (const text of [r.port, r.bind]) expect(plain(text)).not.toBe(text);
  });
});

describe("vt: figuras del artículo de ufw y Docker", () => {
  it("las dos figuras están registradas, anchas, con su descripción y un pie que dice que no son capturas", async () => {
    const { FIGURES, isFigureName } = await import("@/tenants/vt/figures/registry");
    for (const name of ["ufw-cadenas", "ufw-arreglos"] as const) {
      expect(isFigureName(name)).toBe(true);
      expect(FIGURES[name]).toMatchObject({ wide: true });
      expect(FIGURES[name].label.length).toBeGreaterThan(200);
      expect(FIGURES[name].caption).toMatch(/documentación de Docker/);
    }
    expect(FIGURES["ufw-cadenas"].caption).toMatch(/No es una captura/);
  });

  it("ufw-cadenas: solo el puerto publicado en todas las direcciones se desvía, y entonces ufw no ve el paquete", async () => {
    const { MODES, PUBLISH, routeOf, ufwSees } = await import("@/tenants/vt/figures/UfwCadenas");
    expect(PUBLISH).toEqual({ publica: "all", loopback: "loopback", sin: null });
    expect(MODES.map(routeOf)).toEqual(["forward", "input", "input"]);
    expect(MODES.map(ufwSees)).toEqual([false, true, true]);
  });

  it("ufw-cadenas: por FORWARD llega a la base sin pasar por INPUT; por INPUT, ufw lo descarta", async () => {
    const { CADENAS_START, CHAINS, LAST, MODES, cadenasEnd, simulateCadenas } = await import("@/tenants/vt/figures/UfwCadenas");
    const end = (mode: (typeof MODES)[number]) => simulateCadenas(mode, cadenasEnd(mode));

    // el cuadro inicial es el puerto publicado, con el paquete ya en la base
    expect(simulateCadenas("publica", CADENAS_START)).toEqual(end("publica"));
    expect(CHAINS).toBe(3);
    expect(end("publica")).toMatchObject({
      route: "forward",
      reach: LAST.forward,
      rewritten: true,
      chains: 3,
      ufwMatched: false,
      dropped: false,
      arrived: true,
      dot: null,
      phase: "done",
      done: true,
    });
    for (const mode of ["loopback", "sin"] as const) {
      expect(end(mode)).toMatchObject({
        route: "input",
        reach: LAST.input,
        rewritten: false,
        chains: 0,
        ufwMatched: true,
        dropped: true,
        arrived: false,
        dot: null,
        done: true,
      });
    }

    for (const mode of MODES) {
      let lastReach = 0;
      for (let t = 0; t <= cadenasEnd(mode); t += 0.02) {
        const f = simulateCadenas(mode, t);
        // avanza, nunca vuelve, y el punto está sobre lo recorrido
        expect(f.reach).toBeGreaterThanOrEqual(lastReach - 1e-9);
        lastReach = f.reach;
        if (f.dot) expect(f.dot.s).toBeLessThanOrEqual(f.reach + 1e-9);
        // nunca las dos cosas: o ufw lo ve o llega a la base
        expect(f.ufwMatched && f.arrived).toBe(false);
        // la tabla nat cambia el destino recién cuando el paquete pasa por ahí
        if (f.rewritten) expect(f.reach).toBeGreaterThanOrEqual(1);
        // las cadenas de Docker se recorren solo por FORWARD, y después del ruteo
        if (f.chains > 0) expect([f.route, f.reach >= 3]).toEqual(["forward", true]);
        if (f.ufwMatched) expect([f.route, f.reach >= 3]).toEqual(["input", true]);
      }
    }

    // el orden: tabla nat, ruteo, y recién ahí FORWARD o INPUT
    const phases = (mode: (typeof MODES)[number]) => {
      const seen: string[] = [];
      for (let t = 0; t <= cadenasEnd(mode); t += 0.01) {
        const p = simulateCadenas(mode, t).phase;
        if (seen[seen.length - 1] !== p) seen.push(p);
      }
      return seen;
    };
    for (const mode of MODES) expect(phases(mode)).toEqual(["out", "nat", "route", "gate", "done"]);
  });

  it("ufw-cadenas: los textos dicen lo que dice la doc, con direcciones de documentación", async () => {
    const { copy } = await import("@/tenants/vt/messages");
    const m = copy.figures.ufwCadenas;
    expect(m.chains.map((c) => c.name)).toEqual(["DOCKER-USER", "DOCKER-FORWARD", "DOCKER"]);
    expect(m.input.rules).toEqual(["deny 5432/tcp", "default deny incoming"]);
    // 203.0.113.0/24 es TEST-NET-3 (RFC 5737)
    expect(m.source.ip).toMatch(/^203\.0\.113\./);
    // con 127.0.0.1 la figura avisa que la doc da el resultado, no la regla
    expect(m.results.loopback).toMatch(/Según la documentación/);
    expect(m.results.loopback).toMatch(/solo el host/);
  });

  it("ufw-arreglos: quién llega a la base en cada opción", async () => {
    const { ALLOWED_IP, NOTES, OPTIONS, OUTSIDE, REACH, SOURCES, exposed } = await import("@/tenants/vt/figures/UfwArreglos");
    expect(OPTIONS).toEqual(["abierto", "sinPorts", "loopback", "dockerUser"]);
    expect(SOURCES).toEqual(["app", "host", "lan", "internet"]);
    const row = (o: (typeof OPTIONS)[number]) => SOURCES.map((s) => REACH[o][s]);
    expect(row("abierto")).toEqual(["yes", "yes", "yes", "yes"]);
    expect(row("sinPorts")).toEqual(["yes", "no", "no", "no"]);
    expect(row("loopback")).toEqual(["yes", "yes", "no", "no"]);
    expect(row("dockerUser")).toEqual(["yes", "yes", "only", "only"]);
    // tu app llega siempre; de afuera, sin autorización, solo en el punto de partida
    for (const o of OPTIONS) expect(REACH[o].app).toBe("yes");
    for (const o of OPTIONS) for (const s of SOURCES) expect(exposed(o, s)).toBe(o === "abierto" && OUTSIDE.includes(s));
    // las salvedades de la doc: el host llega a la IP del contenedor; antes de la 28.0.0, el mismo segmento llegaba a 127.0.0.1
    expect(NOTES.sinPorts.host?.aside).toMatch(/IP del contenedor/);
    expect(NOTES.loopback.lan?.warn).toMatch(/28\.0\.0/);
    expect(ALLOWED_IP).toBe("192.0.2.2");
  });

  it("ufw-arreglos: las conexiones que no llegan quedan frenadas antes de la base", async () => {
    const { ARREGLOS_START, FIRST, OPTIONS, REACH, SOURCES, STOP_P, arreglosEnd, simulateArreglos } = await import(
      "@/tenants/vt/figures/UfwArreglos"
    );
    expect(simulateArreglos(FIRST, ARREGLOS_START)).toEqual(simulateArreglos(FIRST, arreglosEnd(FIRST)));
    for (const o of OPTIONS) {
      const last = simulateArreglos(o, arreglosEnd(o));
      expect(last).toMatchObject({ going: false, done: true });
      for (const s of SOURCES) {
        const yes = REACH[o][s] === "yes";
        expect(last.rows[s]).toMatchObject({ settled: true, arrived: yes, blocked: !yes, dot: null, p: yes ? 1 : STOP_P });
      }
      for (let t = 0; t <= arreglosEnd(o); t += 0.02) {
        const f = simulateArreglos(o, t);
        for (const s of SOURCES) {
          const r = f.rows[s];
          if (REACH[o][s] !== "yes") expect(r.p).toBeLessThanOrEqual(STOP_P + 1e-9);
          if (r.dot) expect(r.dot.p).toBeLessThanOrEqual(r.p + 1e-9);
          expect(r.arrived && r.blocked).toBe(false);
        }
      }
    }
  });

  it("ufw-arreglos: la línea de cada opción y la regla de ejemplo de la doc", async () => {
    const { copy } = await import("@/tenants/vt/messages");
    const c = copy.figures.ufwArreglos.config;
    expect(c.abierto).toEqual({ lines: ["ports:", '  - "5432:5432"'], removed: false, rule: null });
    expect(c.sinPorts.removed).toBe(true);
    expect(c.loopback.lines[1]).toBe('  - "127.0.0.1:5432:5432"');
    expect(c.dockerUser.rule).toBe("iptables -I DOCKER-USER -i ext_if ! -s 192.0.2.2 -j DROP");
  });
});

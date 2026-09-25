"use client";

import { useState, type CSSProperties } from "react";
import { copy } from "../messages";
import { cubic, frame, rectPts, sheetPts, xmark, type Cubic, type Pt } from "./ink";
import { useTweenNumber } from "./motion";
import { Drawn, FigureFrame, Glyph, Marks, Node, Paper, tr, type FigureProps } from "./parts";
import { rich } from "./rich";
import { FLASH, lerp, sent, STILL, usePlayClock } from "./sim";

const m = copy.figures.respawn;

/** Los dos primeros PID son los de la demo real del artículo; después, de a 33 */
export const FIRST_PIDS = [3366803, 3366835] as const;
export const nextPid = (pid: number) => (pid === FIRST_PIDS[0] ? FIRST_PIDS[1] : pid + 33);

/* ---------- simulación ---------- */

/** Cuánto tarda systemd en relanzarlo en la figura (en la demo fue menos de un segundo) */
const RESPAWN = 1.1;
/** Un pedido cada 0,8 s: del cliente al puerto, del puerto al proceso, y la vuelta */
const REQ = { period: 0.8, offset: 0.1 } as const;
const TO_PORT = 0.6;
const TO_CHILD = 0.45;
const WORK = 0.25;
/** El cuadro inicial: pedidos en vuelo y un par ya contestados */
export const RS_START = 2.6;

export type Action = "kill" | "stop" | "start";
export type RespawnEvent = { t: number; action: Action };
export type ProcState = {
  unit: "active" | "inactive";
  up: boolean;
  pid: number;
  restarts: number;
  last: "running" | "down" | "respawned" | "stopped" | "started";
  /** Avance del relanzamiento (0 a 1) mientras systemd lo está por levantar */
  relaunch: number | null;
};

/** Estado del servicio en `t`, aplicando en orden lo que hizo el lector */
export function procAt(events: readonly RespawnEvent[], t: number): ProcState {
  const s: ProcState = { unit: "active", up: true, pid: FIRST_PIDS[0], restarts: 0, last: "running", relaunch: null };
  let downSince: number | null = null;
  const respawnBy = (x: number) => {
    if (downSince !== null && s.unit === "active" && downSince + RESPAWN <= x) {
      s.up = true;
      s.pid = nextPid(s.pid);
      s.restarts++;
      s.last = "respawned";
      downSince = null;
    }
  };
  for (const ev of events) {
    if (ev.t > t) break;
    respawnBy(ev.t);
    if (ev.action === "kill" && s.unit === "active" && s.up) {
      s.up = false;
      s.last = "down";
      downSince = ev.t;
    } else if (ev.action === "stop" && s.unit === "active") {
      s.unit = "inactive";
      s.up = false;
      s.last = "stopped";
      downSince = null;
    } else if (ev.action === "start" && s.unit === "inactive") {
      s.unit = "active";
      s.up = true;
      s.pid = nextPid(s.pid);
      s.last = "started";
    }
  }
  respawnBy(t);
  if (downSince !== null) s.relaunch = (t - downSince) / RESPAWN;
  return s;
}

type Seg = "in" | "inside" | "back" | "out" | "port" | "child";
export type RespawnDot = { key: string; kind: "req" | "res"; seg: Seg; p: number };
export type RespawnFlash = { key: string; at: "port" | "child"; opacity: number };
export type RespawnFrame = { state: ProcState; dots: RespawnDot[]; flashes: RespawnFlash[]; served: number; failed: number };

/**
 * Pedidos de un cliente al puerto. Si al llegar no hay proceso (murió y systemd
 * todavía no lo levantó, o la unidad está parada) rebotan en el puerto; si el
 * proceso muere mientras lo atiende, se corta ahí.
 */
export function simulateRespawn(events: readonly RespawnEvent[], t: number): RespawnFrame {
  const f: RespawnFrame = { state: procAt(events, t), dots: [], flashes: [], served: 0, failed: 0 };
  for (const s of sent(t, REQ)) {
    const key = `q${s}`;
    const tp = s + TO_PORT;
    if (t < tp) {
      f.dots.push({ key, kind: "req", seg: "in", p: (t - s) / TO_PORT });
      continue;
    }
    const atPort = procAt(events, tp);
    if (!atPort.up) {
      f.failed++;
      if (t < tp + FLASH) f.flashes.push({ key, at: "port", opacity: 1 - (t - tp) / FLASH });
      continue;
    }
    const tc = tp + TO_CHILD;
    const tw = tc + WORK;
    const done = procAt(events, tw);
    if (!done.up || done.pid !== atPort.pid) {
      // el proceso que lo estaba atendiendo ya no existe
      if (t < tc) f.dots.push({ key, kind: "req", seg: "inside", p: (t - tp) / TO_CHILD });
      else if (t < tw) f.dots.push({ key, kind: "req", seg: "child", p: 0 });
      else {
        f.failed++;
        if (t < tw + FLASH) f.flashes.push({ key, at: "child", opacity: 1 - (t - tw) / FLASH });
      }
      continue;
    }
    const tb = tw + TO_CHILD;
    const tEnd = tb + TO_PORT;
    if (t < tc) f.dots.push({ key, kind: "req", seg: "inside", p: (t - tp) / TO_CHILD });
    else if (t < tw) f.dots.push({ key, kind: "req", seg: "child", p: 0 });
    else if (t < tb) f.dots.push({ key, kind: "res", seg: "back", p: (t - tw) / TO_CHILD });
    else if (t < tEnd) f.dots.push({ key, kind: "res", seg: "out", p: (t - tb) / TO_PORT });
    else f.served++;
  }
  return f;
}

/* ---------- dibujo ---------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  narrow: boolean;
  M: number;
  W: number;
  H: number;
  unit: Box;
  unitText: [Pt, Pt, Pt];
  status: Box;
  child: Box;
  childText: [Pt, Pt];
  watch: [Pt, Pt];
  childEdge: Pt;
  port: Pt;
  portLabel: Pt;
  portAnchor: "start" | "middle";
  portStatus: Pt;
  client: Pt;
  glyph: Pt;
  clientLabel: Pt;
  clientAnchor: "start" | "middle";
  arc: Cubic;
};

const WIDE: Geo = {
  narrow: false,
  M: 20,
  W: 720,
  H: 200,
  unit: { x: 0, y: 44, w: 200, h: 132 },
  unitText: [
    [14, 68],
    [14, 88],
    [14, 108],
  ],
  status: { x: 14, y: 138, w: 150, h: 24 },
  child: { x: 250, y: 44, w: 200, h: 112 },
  childText: [
    [264, 68],
    [264, 92],
  ],
  watch: [
    [200, 100],
    [250, 100],
  ],
  childEdge: [450, 100],
  port: [520, 100],
  portLabel: [520, 76],
  portAnchor: "middle",
  portStatus: [520, 128],
  client: [680, 100],
  glyph: [680, 88],
  clientLabel: [692, 136],
  clientAnchor: "middle",
  arc: cubic([100, 44], [100, 4], [350, 4], [350, 44]),
};

const NARROW: Geo = {
  narrow: true,
  M: 12,
  W: 380,
  H: 430,
  unit: { x: 0, y: 8, w: 380, h: 132 },
  unitText: [
    [14, 32],
    [14, 52],
    [14, 72],
  ],
  status: { x: 14, y: 100, w: 150, h: 24 },
  child: { x: 0, y: 178, w: 380, h: 112 },
  childText: [
    [14, 202],
    [14, 226],
  ],
  watch: [
    [190, 140],
    [190, 178],
  ],
  childEdge: [190, 290],
  port: [190, 340],
  portLabel: [204, 336],
  portAnchor: "start",
  portStatus: [204, 356],
  client: [190, 390],
  glyph: [178, 390],
  clientLabel: [212, 408],
  clientAnchor: "start",
  arc: cubic([300, 140], [388, 140], [388, 178], [300, 178]),
};

function Chip({ x, y, w, h, kind, text, style }: Box & { kind: "ink" | "dead"; text: string; style?: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx={4} className={`s-tag-${kind}`} />
      <text x={x + 10} y={y + h / 2 + 4} className={`t-${kind}`}>
        {text}
      </text>
    </g>
  );
}

const shown = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 });

function Scene({ G, f, dots, label }: { G: Geo; f: RespawnFrame; dots: boolean; label: string }) {
  const { viewBox, vb } = frame(G.W, G.H, G.M);
  const { unit: U, child: C } = G;
  const s = f.state;
  const relaunching = s.relaunch !== null;
  const place = (seg: Seg, p: number): Pt => {
    if (seg === "in") return lerp(G.client, G.port, p);
    if (seg === "inside") return lerp(G.port, G.childEdge, p);
    if (seg === "back") return lerp(G.childEdge, G.port, p);
    if (seg === "out") return lerp(G.port, G.client, p);
    return seg === "port" ? G.port : G.childEdge;
  };

  return (
    <svg className={`ink ${G.narrow ? "geo-n" : "geo-w"}`} viewBox={viewBox} role="img" aria-label={label}>
      <Paper vb={vb} step={20} />

      <Drawn pts={rectPts(U.x, U.y, U.w, U.h)} seed={701} />
      <text x={G.unitText[0][0]} y={G.unitText[0][1]} className="s-title">
        {m.unit}
      </text>
      <Glyph name="server" x={U.x + U.w - 30} y={U.y + 11} />
      <text x={G.unitText[1][0]} y={G.unitText[1][1]} className="s-lab">
        {m.watches}
      </text>
      <text x={G.unitText[2][0]} y={G.unitText[2][1]} className="s-lab s-mono">
        {m.restart}
      </text>
      <Chip {...G.status} kind="ink" text={m.active} style={shown(s.unit === "active")} />
      <Chip {...G.status} kind="dead" text={m.inactive} style={shown(s.unit === "inactive")} />

      <path d={`M${G.watch[0][0]} ${G.watch[0][1]}L${G.watch[1][0]} ${G.watch[1][1]}`} className="s-guide" />
      {/* el gesto de systemd: vuelve a lanzar el proceso */}
      <path
        d={G.arc.d}
        className="s-link"
        style={{
          ...STILL,
          strokeDasharray: `${G.arc.dash} ${G.arc.dash}`,
          strokeDashoffset: G.arc.dash * (1 - Math.min(1, s.relaunch ?? 0)),
          opacity: relaunching ? 1 : 0,
        }}
      />

      <g className={s.up ? undefined : "quick"} style={{ opacity: s.up ? 1 : 0, transform: s.up ? tr(0, 0) : tr(0, 8) }}>
        <Drawn pts={sheetPts(C.x, C.y, C.w, C.h, 12)} seed={702} fold={12} />
        <text x={G.childText[0][0]} y={G.childText[0][1]} className="s-file">
          {m.process}
        </text>
        <text x={G.childText[1][0]} y={G.childText[1][1]} className="s-hash">
          {m.pid(s.pid)}
        </text>
      </g>

      {/* la red: del cliente al puerto siempre hay cable; del puerto al proceso, solo si hay proceso */}
      <path d={`M${G.client[0]} ${G.client[1]}L${G.port[0]} ${G.port[1]}`} className="s-link" />
      <path d={`M${G.childEdge[0]} ${G.childEdge[1]}L${G.port[0]} ${G.port[1]}`} className="s-link" style={shown(s.up)} />
      <Node cx={G.port[0]} cy={G.port[1]} r={5.5} />
      <text x={G.portLabel[0]} y={G.portLabel[1]} textAnchor={G.portAnchor} className="s-hash">
        {m.port}
      </text>
      <text x={G.portStatus[0]} y={G.portStatus[1]} textAnchor={G.portAnchor} className="s-lab">
        {s.up ? m.busy(s.pid) : m.free}
      </text>
      <Glyph name="laptop" x={G.glyph[0]} y={G.glyph[1]} s={24} />
      <text x={G.clientLabel[0]} y={G.clientLabel[1]} textAnchor={G.clientAnchor} className="s-lab">
        {m.client}
      </text>

      {dots &&
        f.dots.map((d) => {
          const [x, y] = place(d.seg, d.p);
          return <circle key={d.key} cx={x} cy={y} r={d.kind === "req" ? 5 : 5.5} className={d.kind === "req" ? "s-req" : "s-res"} style={STILL} />;
        })}
      {f.flashes.map((x) => {
        const [px, py] = x.at === "port" ? G.port : G.childEdge;
        return <path key={x.key} d={xmark(px, py, 7)} className="s-x" style={{ ...STILL, opacity: x.opacity }} />;
      })}
    </svg>
  );
}

function result(s: ProcState) {
  if (s.last === "respawned") return m.results.respawned(s.pid);
  if (s.last === "started") return m.results.started(s.pid);
  return m.results[s.last];
}

/** Figura: pedidos a un servicio que vigila systemd; matar el proceso o parar el servicio */
export function Respawn({ name, wide, label, caption }: FigureProps) {
  const [events, setEvents] = useState<RespawnEvent[]>([]);
  const { t, playing, reduced, clock, canvas, play, toggle } = usePlayClock(RS_START);
  const f = simulateRespawn(events, t);
  const s = f.state;
  const restarts = useTweenNumber(s.restarts);

  function act(action: Action) {
    setEvents((prev) => [...prev, { t: clock.current, action }]);
    if (!playing) play();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas" ref={canvas}>
        <Scene G={WIDE} f={f} dots={!reduced} label={label} />
        <Scene G={NARROW} f={f} dots={!reduced} label={label} />
        <Marks />
      </div>
      <div className="fig-foot">
        <div className="presets" role="group" aria-label={m.actions}>
          <button type="button" disabled={!(s.unit === "active" && s.up)} onClick={() => act("kill")}>
            {m.buttons.kill}
          </button>
          <button type="button" disabled={s.unit !== "active"} onClick={() => act("stop")}>
            {m.buttons.stop}
          </button>
          <button type="button" disabled={s.unit !== "inactive"} onClick={() => act("start")}>
            {m.buttons.start}
          </button>
        </div>
        <div className="sim-controls">
          <button type="button" className="plain" aria-pressed={playing} onClick={toggle}>
            {playing ? `⏸ ${m.pause}` : `▶ ${m.play}`}
          </button>
        </div>
        <div className="counter" aria-hidden="true">
          <span>
            {m.counters.restarts}
            <b>{restarts}</b>
          </span>
          <span>
            {m.counters.served}
            <b>{f.served}</b>
          </span>
          <span>
            {m.counters.failed}
            <b>{f.failed}</b>
          </span>
        </div>
        <p className="fig-result" aria-live="polite">
          {rich(result(s))}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

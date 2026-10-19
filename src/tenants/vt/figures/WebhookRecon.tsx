"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { copy } from "../messages";
import { useTweenNumber } from "./motion";
import { FigureFrame, Marks, type FigureProps } from "./parts";
import { rich } from "./rich";
import { pesos } from "./WebhookRetry";

const m = copy.figures.webhookRecon;

export type Receiver = "naive" | "check" | "hardened";
const RECEIVERS: Receiver[] = ["naive", "check", "hardened"];

type Entry = { status: string; credit: number };
type Row = {
  /** Lo que liquidó el proveedor */
  provider: { status: string | null; amount: number };
  /** Lo que tendría que haber en tu base */
  want: Entry;
  /** Lo que quedó con cada receptor (null: ese receptor no corrió esta entrega) */
  got: Record<Receiver, Entry | null>;
};

/**
 * La conciliación del laboratorio (run_lab.py, 14/10): el receptor ingenuo
 * corrió las cinco entregas, el que busca y después anota solo los dos
 * reintentos, y el endurecido las cinco.
 */
export const ROWS: Row[] = [
  {
    provider: { status: "approved", amount: 25000 },
    want: { status: "paid", credit: 25000 },
    got: { naive: { status: "paid", credit: 50000 }, check: { status: "paid", credit: 25000 }, hardened: { status: "paid", credit: 25000 } },
  },
  {
    provider: { status: "approved", amount: 18500 },
    want: { status: "paid", credit: 18500 },
    got: { naive: { status: "paid", credit: 37000 }, check: { status: "paid", credit: 37000 }, hardened: { status: "paid", credit: 18500 } },
  },
  {
    provider: { status: "approved", amount: 42000 },
    want: { status: "paid", credit: 42000 },
    got: { naive: { status: "paid", credit: 84000 }, check: null, hardened: { status: "paid", credit: 42000 } },
  },
  {
    provider: { status: null, amount: 0 },
    want: { status: "created", credit: 0 },
    got: { naive: { status: "paid", credit: 30000 }, check: null, hardened: { status: "created", credit: 0 } },
  },
  {
    provider: { status: "refunded", amount: 0 },
    want: { status: "refunded", credit: 0 },
    got: { naive: { status: "paid", credit: 0 }, check: null, hardened: { status: "refunded", credit: 0 } },
  },
];

/** La escala de las barras: el mayor monto acreditado en cualquier receptor */
const MAX = Math.max(...ROWS.flatMap((r) => RECEIVERS.map((k) => r.got[k]?.credit ?? 0)));

export function differs(row: Row, k: Receiver): boolean | null {
  const got = row.got[k];
  if (!got) return null;
  return got.status !== row.want.status || got.credit !== row.want.credit;
}

/** Diferencias, entregas probadas y acreditado de más de un receptor */
export function reconcile(k: Receiver) {
  const tested = ROWS.filter((r) => r.got[k]);
  const diffs = tested.filter((r) => differs(r, k));
  const over = diffs.reduce((n, r) => n + Math.max(0, (r.got[k]?.credit ?? 0) - r.want.credit), 0);
  return { tested: tested.length, diffs: diffs.length, over };
}

const pct = (n: number) => `${((n / MAX) * 100).toFixed(2)}%`;

function Bar({ row, k }: { row: Row; k: Receiver }) {
  const got = row.got[k];
  const credit = got?.credit ?? 0;
  const want = row.want.credit;
  const fill: CSSProperties = { width: pct(Math.min(credit, want)) };
  const over: CSSProperties = { left: pct(want), width: pct(Math.max(0, credit - want)) };
  return (
    <span className={got ? "wr-bar" : "wr-bar off"} aria-hidden="true">
      <i className="wr-fill" style={fill} />
      <i className="wr-over" style={over} />
      <i className="wr-want" style={{ left: pct(want) }} />
    </span>
  );
}

/** Figura: las cinco órdenes del laboratorio conciliadas contra el proveedor, con cada receptor */
export function WebhookRecon({ name, wide, label, caption }: FigureProps) {
  const [k, setK] = useState<Receiver>("naive");
  const seg = useRef<HTMLDivElement>(null);
  const total = reconcile(k);
  const over = useTweenNumber(total.over);

  function onSegKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const step = e.key === "ArrowRight" ? 1 : RECEIVERS.length - 1;
    const next = RECEIVERS[(RECEIVERS.indexOf(k) + step) % RECEIVERS.length];
    setK(next);
    seg.current?.querySelector<HTMLButtonElement>(`[data-receiver="${next}"]`)?.focus();
    e.preventDefault();
  }

  return (
    <FigureFrame name={name} wide={wide}>
      <div className="seg" role="radiogroup" aria-label={m.choose} ref={seg} onKeyDown={onSegKey}>
        <span aria-hidden="true">{`${m.choose}:`}</span>
        {RECEIVERS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={k === o}
            tabIndex={k === o ? 0 : -1}
            data-receiver={o}
            onClick={() => setK(o)}
          >
            {m.receivers[o]}
          </button>
        ))}
      </div>
      <div className="fig-canvas wr-canvas">
        <div className="wr-panel" role="table" aria-label={label}>
          <p className="wr-kicker">{m.kicker}</p>
          <div className="wr-row wr-head" role="row">
            <span role="columnheader">{m.columns.delivery}</span>
            <span role="columnheader">{m.columns.provider}</span>
            <span role="columnheader">{m.columns.base}</span>
            <span role="columnheader" aria-hidden="true" />
          </div>
          {ROWS.map((row, i) => {
            const got = row.got[k];
            const diff = differs(row, k);
            const meta = m.rows[i];
            return (
              <div key={meta.order} className="wr-row" role="row" data-state={diff === null ? "untested" : diff ? "bad" : "ok"}>
                <span className="wr-what" role="cell">
                  {meta.delivery}
                  <small>{meta.order}</small>
                </span>
                <span className="wr-provider" role="cell">
                  {row.provider.status ? `${row.provider.status} · ${pesos(row.provider.amount)}` : m.noPayment}
                </span>
                <span className="wr-base" role="cell">
                  {got ? `${got.status} · ${pesos(got.credit)}` : m.untested}
                </span>
                <span className="wr-meter" role="cell">
                  <Bar row={row} k={k} />
                  <b className="wr-mark" aria-hidden="true">
                    {diff === null ? "–" : diff ? "✗" : "✓"}
                  </b>
                </span>
              </div>
            );
          })}
          <div className="wr-total">
            <span>
              {m.differences}
              <b className={total.diffs ? "bad" : "ok"}>{m.of(total.diffs, total.tested)}</b>
            </span>
            <span>
              {m.over}
              <b className={total.over ? "bad" : "ok"}>{pesos(over)}</b>
            </span>
          </div>
        </div>
        <Marks />
      </div>
      <div className="fig-foot">
        <p className="fig-result" aria-live="polite">
          {rich(m.notes[k])}
        </p>
        {caption && <figcaption className="fig-small">{caption}</figcaption>}
      </div>
    </FigureFrame>
  );
}

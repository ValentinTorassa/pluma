/**
 * Reportes de violaciones de la CSP (feature `cspReports`).
 *
 * Los navegadores los mandan solos a POST /api/csp-report, en uno de dos
 * formatos según el mecanismo que usen:
 *
 *   application/csp-report    `report-uri` (Firefox, Safari): un objeto
 *                             `{ "csp-report": { "document-uri", "blocked-uri", … } }`
 *   application/reports+json  Reporting API (`report-to` + Reporting-Endpoints,
 *                             Chrome): un array de `{ type: "csp-violation",
 *                             body: { documentURL, blockedURL, … } }`
 *
 * De cada uno se guarda solo lo que sirve para decidir si la política rompe
 * algo, ya agregado: directiva, qué se bloqueó (origen, esquema o palabra
 * clave, nunca la URL entera), ruta del documento y modo. Nada de IP, user
 * agent, referrer, muestra de código ni política original. Pura: la usa el
 * route handler y se prueba sin base.
 */

/** Tope del body. Un reporte real pesa ~1 KB (la política original es lo más largo) */
export const MAX_REPORT_BYTES = 16 * 1024;

/** Reportes que se procesan por pedido (Chrome junta varios en un array); el resto se ignora */
export const MAX_REPORTS_PER_REQUEST = 20;

/** Filas distintas que puede tener la tabla. Llena, solo suman las que ya existen */
export const MAX_CSP_ROWS = 500;

export type CspReportFormat = "csp-report" | "reports";

export type CspViolation = {
  directive: string;
  blocked: string;
  path: string;
  disposition: "report" | "enforce" | "-";
};

/** El formato según el Content-Type, o `null` si no es un reporte de CSP (415) */
export function reportFormat(contentType: string | null): CspReportFormat | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/csp-report") return "csp-report";
  if (type === "application/reports+json") return "reports";
  return null;
}

const DIRECTIVE = /^[a-z][a-z-]{1,39}$/;
const KEYWORD = /^[a-z][a-z-]{0,29}$/;
const MAX_PATH = 200;
const MAX_BLOCKED = 100;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Qué se bloqueó, sin la URL entera: el origen para http(s)/ws(s), el esquema
 * para el resto (`data:`, `blob:`, `chrome-extension:`), la palabra clave que
 * mandan los navegadores para lo que no es una URL (`inline`, `eval`,
 * `wasm-eval`, `trusted-types-sink`…) y `-` si no vino nada.
 */
export function blockedSource(raw: unknown): string {
  const value = str(raw);
  if (!value) return "-";
  if (KEYWORD.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "?";
  }
  const source = /^(https?|wss?):$/.test(url.protocol) ? url.origin : url.protocol;
  return source.slice(0, MAX_BLOCKED);
}

/** Ruta del documento (sin query ni fragmento), o `null` si no es una URL http(s) */
export function documentPath(raw: unknown): string | null {
  let url: URL;
  try {
    url = new URL(str(raw));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.pathname.slice(0, MAX_PATH);
}

function disposition(raw: unknown): CspViolation["disposition"] {
  const value = str(raw);
  return value === "report" || value === "enforce" ? value : "-";
}

function violation(fields: {
  directive: unknown;
  violated?: unknown;
  blocked: unknown;
  document: unknown;
  disposition: unknown;
}): CspViolation | null {
  // effective-directive es la que de verdad se aplicó (script-src-elem, no
  // script-src); los navegadores viejos solo mandan violated-directive, que
  // puede traer las fuentes detrás.
  const directive = (str(fields.directive) || str(fields.violated).split(/\s+/)[0]).toLowerCase();
  if (!DIRECTIVE.test(directive)) return null;
  const path = documentPath(fields.document);
  if (path === null) return null;
  return { directive, blocked: blockedSource(fields.blocked), path, disposition: disposition(fields.disposition) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Las violaciones válidas del body, o `null` si el body no tiene la forma del
 * formato (400). Un reporte suelto que no sirve (otro `type`, sin directiva,
 * documento que no es http) se descarta sin invalidar el resto.
 */
export function parseCspReports(format: CspReportFormat, body: unknown): CspViolation[] | null {
  if (format === "csp-report") {
    if (!isObject(body) || !isObject(body["csp-report"])) return null;
    const r = body["csp-report"];
    const v = violation({
      directive: r["effective-directive"],
      violated: r["violated-directive"],
      blocked: r["blocked-uri"],
      document: r["document-uri"],
      disposition: r["disposition"],
    });
    return v ? [v] : [];
  }

  if (!Array.isArray(body)) return null;
  const out: CspViolation[] = [];
  for (const report of body.slice(0, MAX_REPORTS_PER_REQUEST)) {
    if (!isObject(report) || report.type !== "csp-violation" || !isObject(report.body)) continue;
    const r = report.body;
    const v = violation({
      directive: r.effectiveDirective,
      blocked: r.blockedURL,
      document: r.documentURL ?? report.url,
      disposition: r.disposition,
    });
    if (v) out.push(v);
  }
  return out;
}

/** Junta las violaciones iguales del mismo pedido: una escritura por fila, con su cuenta */
export function aggregate(violations: CspViolation[]): { violation: CspViolation; count: number }[] {
  const rows = new Map<string, { violation: CspViolation; count: number }>();
  for (const v of violations) {
    const key = JSON.stringify([v.directive, v.blocked, v.path, v.disposition]);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { violation: v, count: 1 });
  }
  return [...rows.values()];
}

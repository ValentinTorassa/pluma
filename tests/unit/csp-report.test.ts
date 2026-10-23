import { describe, expect, it } from "vitest";
import {
  MAX_REPORTS_PER_REQUEST,
  aggregate,
  blockedSource,
  documentPath,
  parseCspReports,
  reportFormat,
} from "@/lib/csp-report";

/** Un reporte de `report-uri` como lo manda Firefox (con campos que no se guardan) */
const uriReport = {
  "csp-report": {
    "document-uri": "https://vtsecurity.com.ar/articulo/x?utm_source=y#c",
    referrer: "https://www.google.com/",
    "violated-directive": "script-src-elem",
    "effective-directive": "script-src-elem",
    "original-policy": "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'",
    disposition: "report",
    "blocked-uri": "https://evil.example/x.js?token=secret",
    "script-sample": "",
    "status-code": 200,
  },
};

/** Lo mismo en la Reporting API (Chrome), dos violaciones en un array */
const apiReports = [
  {
    type: "csp-violation",
    age: 10,
    url: "https://vtsecurity.com.ar/",
    user_agent: "Mozilla/5.0 …",
    body: {
      documentURL: "https://vtsecurity.com.ar/",
      blockedURL: "inline",
      effectiveDirective: "script-src-elem",
      disposition: "enforce",
      sample: "alert(1)",
      sourceFile: "https://vtsecurity.com.ar/",
    },
  },
  {
    type: "csp-violation",
    url: "https://vtsecurity.com.ar/series",
    body: {
      documentURL: "https://vtsecurity.com.ar/series",
      blockedURL: "data:text/javascript;base64,AAAA",
      effectiveDirective: "script-src-elem",
      disposition: "report",
    },
  },
];

describe("reportFormat", () => {
  it("solo acepta los Content-Type de los reportes de CSP", () => {
    expect(reportFormat("application/csp-report")).toBe("csp-report");
    expect(reportFormat("Application/CSP-Report; charset=utf-8")).toBe("csp-report");
    expect(reportFormat("application/reports+json")).toBe("reports");
    expect(reportFormat("application/json")).toBeNull();
    expect(reportFormat("text/plain;charset=UTF-8")).toBeNull();
    expect(reportFormat(null)).toBeNull();
  });
});

describe("blockedSource", () => {
  it("guarda el origen, el esquema o la palabra clave, nunca la URL entera", () => {
    expect(blockedSource("https://evil.example:8443/a.js?token=1")).toBe("https://evil.example:8443");
    expect(blockedSource("wss://socket.example/x")).toBe("wss://socket.example");
    expect(blockedSource("data:text/javascript,alert(1)")).toBe("data:");
    expect(blockedSource("blob:https://vtsecurity.com.ar/0b1c")).toBe("blob:");
    expect(blockedSource("chrome-extension://abcdefghijklmnop/content.js")).toBe("chrome-extension:");
    expect(blockedSource("inline")).toBe("inline");
    expect(blockedSource("eval")).toBe("eval");
    expect(blockedSource("")).toBe("-");
    expect(blockedSource(undefined)).toBe("-");
    expect(blockedSource("no es una URL ni una palabra")).toBe("?");
  });
});

describe("documentPath", () => {
  it("se queda con la ruta, sin query ni fragmento, y solo de http(s)", () => {
    expect(documentPath("https://vtsecurity.com.ar/articulo/x?q=1#c")).toBe("/articulo/x");
    expect(documentPath("http://localhost:3000/")).toBe("/");
    expect(documentPath("about:blank")).toBeNull();
    expect(documentPath("/articulo/x")).toBeNull();
    expect(documentPath(42)).toBeNull();
    expect(documentPath(`https://vtsecurity.com.ar/${"a".repeat(500)}`)).toHaveLength(200);
  });
});

describe("parseCspReports", () => {
  it("report-uri: una violación, normalizada", () => {
    expect(parseCspReports("csp-report", uriReport)).toEqual([
      { directive: "script-src-elem", blocked: "https://evil.example", path: "/articulo/x", disposition: "report" },
    ]);
  });

  it("report-uri viejo: sin effective-directive usa la primera palabra de violated-directive", () => {
    const old = { "csp-report": { "document-uri": "https://a.example/", "violated-directive": "script-src 'self'", "blocked-uri": "eval" } };
    expect(parseCspReports("csp-report", old)).toEqual([
      { directive: "script-src", blocked: "eval", path: "/", disposition: "-" },
    ]);
  });

  it("Reporting API: cada csp-violation del array, y se saltea lo que no es de CSP", () => {
    const body = [...apiReports, { type: "deprecation", url: "https://vtsecurity.com.ar/", body: {} }, "basura", null];
    expect(parseCspReports("reports", body)).toEqual([
      { directive: "script-src-elem", blocked: "inline", path: "/", disposition: "enforce" },
      { directive: "script-src-elem", blocked: "data:", path: "/series", disposition: "report" },
    ]);
  });

  it("Reporting API: mira como mucho los primeros reportes del array", () => {
    const many = Array.from({ length: MAX_REPORTS_PER_REQUEST + 30 }, () => apiReports[0]);
    expect(parseCspReports("reports", many)).toHaveLength(MAX_REPORTS_PER_REQUEST);
  });

  it("body con otra forma es null (400); un reporte suelto inválido se descarta", () => {
    expect(parseCspReports("csp-report", apiReports)).toBeNull();
    expect(parseCspReports("csp-report", { "csp-report": "x" })).toBeNull();
    expect(parseCspReports("csp-report", null)).toBeNull();
    expect(parseCspReports("reports", uriReport)).toBeNull();
    // directiva rara o documento que no es http: no se guarda, pero no es un error
    const bad = (directive: string, document: string) => ({
      "csp-report": { "effective-directive": directive, "document-uri": document, "blocked-uri": "inline" },
    });
    expect(parseCspReports("csp-report", bad("script-src; drop table", "https://a.example/"))).toEqual([]);
    expect(parseCspReports("csp-report", bad("script-src", "chrome-extension://x/y.html"))).toEqual([]);
  });
});

describe("aggregate", () => {
  it("junta las violaciones iguales con su cuenta", () => {
    const a = { directive: "script-src-elem", blocked: "inline", path: "/", disposition: "report" as const };
    const b = { ...a, path: "/series" };
    expect(aggregate([a, b, { ...a }, a])).toEqual([
      { violation: a, count: 3 },
      { violation: b, count: 1 },
    ]);
  });
});

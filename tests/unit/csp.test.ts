import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REPORTING_ENDPOINTS, buildCsp, cspHeaderName } from "@/lib/csp";

/** El proxy entero (src/proxy.ts) con el tenant de prueba: los headers que de verdad salen */
const features = vi.hoisted(() => ({ cspReports: true }));
vi.mock("server-only", () => ({}));
vi.mock("@tenant/config", () => ({ config: { id: "test", sessionCookie: "test_session", features } }));

const { proxy } = await import("@/proxy");

function directives(csp: string | null) {
  return (csp ?? "").split("; ");
}

describe("CSP", () => {
  afterEach(() => {
    delete process.env.PLUMA_CSP_ENFORCE;
    features.cspReports = true;
  });

  it("script-src usa el nonce y no permite inline ni eval en producción", () => {
    const csp = buildCsp("abc123");
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("report-");
  });

  it("en desarrollo permite eval (React lo usa para los stacks)", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("con reportes suma report-uri y report-to sin tocar script-src", () => {
    const csp = buildCsp("abc123", false, true);
    expect(directives(csp)).toContain("report-uri /api/csp-report");
    expect(directives(csp)).toContain("report-to csp");
    expect(directives(csp)).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(REPORTING_ENDPOINTS).toBe('csp="/api/csp-report"');
  });

  it("es Report-Only salvo que PLUMA_CSP_ENFORCE=1", () => {
    expect(cspHeaderName()).toBe("Content-Security-Policy-Report-Only");
    process.env.PLUMA_CSP_ENFORCE = "1";
    expect(cspHeaderName()).toBe("Content-Security-Policy");
  });
});

describe("proxy: headers de la CSP", () => {
  afterEach(() => {
    delete process.env.PLUMA_CSP_ENFORCE;
    features.cspReports = true;
  });

  async function page(path = "/articulo/x") {
    return proxy(new NextRequest(`https://vtsecurity.com.ar${path}`));
  }

  /** El header del request que lee el render de Next (lo aplica el proxy como override) */
  function requestHeader(res: Response, name: string) {
    return res.headers.get(`x-middleware-request-${name.toLowerCase()}`);
  }

  for (const enforce of [false, true]) {
    const mode = enforce ? "bloqueando" : "Report-Only";
    it(`${mode}: la política lleva report-uri y report-to, con Reporting-Endpoints`, async () => {
      if (enforce) process.env.PLUMA_CSP_ENFORCE = "1";
      const res = await page();
      const sent = enforce ? "content-security-policy" : "content-security-policy-report-only";
      const other = enforce ? "content-security-policy-report-only" : "content-security-policy";
      const csp = res.headers.get(sent);
      expect(directives(csp)).toContain("report-uri /api/csp-report");
      expect(directives(csp)).toContain("report-to csp");
      expect(res.headers.get(other)).toBeNull();
      expect(res.headers.get("reporting-endpoints")).toBe('csp="/api/csp-report"');
    });

    it(`${mode}: el nonce llega al render por Content-Security-Policy y x-nonce`, async () => {
      if (enforce) process.env.PLUMA_CSP_ENFORCE = "1";
      const res = await page();
      const nonce = requestHeader(res, "x-nonce");
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(requestHeader(res, "content-security-policy")).toContain(`'nonce-${nonce}'`);
      expect(requestHeader(res, "content-security-policy-report-only")).toBeNull();
      const sent = res.headers.get(enforce ? "content-security-policy" : "content-security-policy-report-only");
      expect(sent).toContain(`'nonce-${nonce}'`);
    });
  }

  it("sin la feature no hay reportes, pero la política es la misma", async () => {
    features.cspReports = false;
    const res = await page("/");
    const csp = res.headers.get("content-security-policy-report-only");
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("report-");
    expect(res.headers.get("reporting-endpoints")).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName } from "@/lib/csp";

describe("CSP", () => {
  afterEach(() => {
    delete process.env.PLUMA_CSP_ENFORCE;
  });

  it("script-src usa el nonce y no permite inline ni eval en producción", () => {
    const csp = buildCsp("abc123");
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("en desarrollo permite eval (React lo usa para los stacks)", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("es Report-Only salvo que PLUMA_CSP_ENFORCE=1", () => {
    expect(cspHeaderName()).toBe("Content-Security-Policy-Report-Only");
    process.env.PLUMA_CSP_ENFORCE = "1";
    expect(cspHeaderName()).toBe("Content-Security-Policy");
  });
});

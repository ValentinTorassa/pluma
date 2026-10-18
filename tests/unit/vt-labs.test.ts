import { describe, expect, it } from "vitest";
import { labTwin } from "@/tenants/vt/labs";

describe("vt: artículo → lab gemelo", () => {
  it("los cuatro artículos de la tabla tienen su página en Open Security Labs", () => {
    for (const slug of [
      "permisos-chmod-777",
      "address-already-in-use",
      "subiste-el-env-a-github",
      "que-cuenta-como-experiencia-en-ciberseguridad",
    ]) {
      expect(labTwin(slug)?.url).toMatch(/^https:\/\/securitylabs\.valentorassa\.com\/.+\/$/);
    }
    expect(labTwin("permisos-chmod-777")?.url).toBe(
      "https://securitylabs.valentorassa.com/labs/ciberseguridad/por-que-chmod-777/",
    );
  });

  it("el resto no tiene link (tampoco lo que viene de Object.prototype)", () => {
    expect(labTwin("docker-y-el-env")).toBeNull();
    expect(labTwin("constructor")).toBeNull();
  });
});

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

  it("la nota del 502 lleva a su lab de redes", () => {
    expect(labTwin("error-502-de-afuera-hacia-adentro")).toEqual({
      url: "https://securitylabs.valentorassa.com/labs/redes-internet/una-request-no-es-magia/",
      title: "Una request no es magia: DNS, TCP, HTTP y latencia",
    });
  });

  it("el resto no tiene link (tampoco lo que viene de Object.prototype)", () => {
    expect(labTwin("docker-y-el-env")).toBeNull();
    expect(labTwin("constructor")).toBeNull();
  });
});

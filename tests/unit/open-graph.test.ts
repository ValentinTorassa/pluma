import { describe, expect, it } from "vitest";
import { ogLocale, siteOpenGraph } from "@/lib/open-graph";

describe("Open Graph", () => {
  it("og:locale va con guion bajo (es_AR), no con la etiqueta de Intl", () => {
    expect(ogLocale("es-AR")).toBe("es_AR");
    expect(ogLocale("es")).toBe("es");
  });

  it("la base del sitio sale del config del tenant", () => {
    expect(siteOpenGraph()).toEqual({ siteName: "Pluma", locale: "es_AR", type: "website" });
  });
});

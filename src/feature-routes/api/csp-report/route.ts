import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { config } from "@tenant/config";
import { readCappedText } from "@/lib/comandle-event";
import { MAX_REPORT_BYTES, aggregate, parseCspReports, reportFormat } from "@/lib/csp-report";
import { recordCspViolation } from "@/lib/csp-reports";

function reply(status: number): Response {
  return new Response(null, { status });
}

/**
 * POST /api/csp-report - violaciones de la CSP que mandan los navegadores
 * (feature `cspReports`; formatos y normalización en src/lib/csp-report.ts).
 *
 * La ruta es pública por fuerza (el navegador reporta sin sesión), así que
 * cualquiera le puede mandar basura. Lo que la acota:
 *
 * - Content-Type: solo `application/csp-report` y `application/reports+json`
 *   (415 si no).
 * - Body de hasta 16 KB, leído con tope (413 si se pasa); JSON roto o que no
 *   tiene la forma del formato es 400. De un array se miran los primeros 20.
 * - Se guarda un agregado por directiva, qué se bloqueó (origen o esquema, no
 *   la URL), ruta y modo, con cuenta y primera/última vez. Nada de IP, hash de
 *   IP, user agent ni URL completa, y sin `rate_limits` (que se indexa por
 *   hash de IP).
 * - La tabla tiene tope (`MAX_CSP_ROWS`): inventando combinaciones se la puede
 *   llenar, y entonces las nuevas se descartan hasta vaciarla desde
 *   /admin/csp. Las que ya existen siguen contando.
 *
 * 204 sin cuerpo si se aceptó (aunque no haya quedado ninguna violación
 * válida o falte la migración 0008, que queda en el log): el navegador no lee
 * la respuesta.
 */
export async function POST(request: NextRequest) {
  if (!config.features.cspReports) notFound();

  const format = reportFormat(request.headers.get("content-type"));
  if (!format) return reply(415);

  const raw = await readCappedText(request, MAX_REPORT_BYTES);
  if (raw === null) return reply(413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400);
  }
  const violations = parseCspReports(format, body);
  if (!violations) return reply(400);

  const now = new Date();
  for (const { violation, count } of aggregate(violations)) {
    await recordCspViolation(violation, count, now);
  }
  return reply(204);
}

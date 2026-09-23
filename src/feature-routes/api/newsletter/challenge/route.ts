import { notFound } from "next/navigation";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { altchaKey, createChallenge } from "@/lib/altcha";

/**
 * GET /api/newsletter/challenge - challenge ALTCHA para el formulario del
 * newsletter (feature `newsletter`). El formulario lo resuelve al enviar y
 * POST /api/newsletter verifica la solución antes de reenviar a listmonk.
 */
export async function GET() {
  if (!config.features.newsletter) notFound();

  const key = altchaKey();
  if (!key) {
    return Response.json(
      { ok: false, message: messages.api.newsletterUnavailable },
      { status: 503 },
    );
  }
  return Response.json(createChallenge(key), { headers: { "Cache-Control": "no-store" } });
}

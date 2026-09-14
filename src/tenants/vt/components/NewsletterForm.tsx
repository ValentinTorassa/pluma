import type { ReactNode } from "react";
import { NewsletterFields } from "./NewsletterFields";

/**
 * Línea de suscripción a Apuntes. Postea a /api/newsletter (mismo origen),
 * que reenvía a NEWSLETTER_SUBSCRIBE_URL. Sin esa variable el formulario se
 * muestra deshabilitado con una nota. Sin scripts de terceros.
 */
export function NewsletterForm({ id, lead }: { id: string; lead: ReactNode }) {
  const enabled = Boolean(process.env.NEWSLETTER_SUBSCRIBE_URL);

  return (
    <div className="nl">
      <p>{lead}</p>
      <NewsletterFields id={id} enabled={enabled} />
    </div>
  );
}

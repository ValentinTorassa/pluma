import type { ReactNode } from "react";
import { listEnabled, type NewsletterList } from "@/lib/newsletter-lists";
import { copy } from "../messages";
import { NewsletterFields } from "./NewsletterFields";

/**
 * Línea de suscripción. Postea a /api/newsletter (mismo origen), que reenvía a
 * NEWSLETTER_SUBSCRIBE_URL. `list` elige la lista: Apuntes por defecto, o la
 * lista de espera del libro (/libro). Si la lista no está configurada, el
 * formulario se muestra deshabilitado con una nota. Sin scripts de terceros.
 */
export function NewsletterForm({
  id,
  lead,
  list = "apuntes",
}: {
  id: string;
  lead: ReactNode;
  list?: NewsletterList;
}) {
  const book = list === "libro";

  return (
    <div className="nl">
      <p>{lead}</p>
      <NewsletterFields
        id={id}
        enabled={listEnabled(list)}
        {...(book ? { list, submitLabel: copy.book.submit, disabledNote: copy.book.disabled } : {})}
      />
    </div>
  );
}

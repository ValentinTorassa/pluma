/**
 * Datos estructurados. `type="application/ld+json"` no se ejecuta (la CSP no
 * aplica); igual se escapa `<` para que el contenido no pueda cerrar el tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

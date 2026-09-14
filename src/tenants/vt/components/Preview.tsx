import type { ReactElement } from "react";
import { renderContent } from "./Content";

/**
 * Vista previa del editor: el cuerpo del artículo con el mismo pipeline y las
 * mismas clases que la página pública (figuras interactivas y código incluidos).
 */
export async function renderPreview(markdown: string): Promise<ReactElement> {
  const { element } = await renderContent(markdown, { anchors: true });
  return (
    <div className="art art-preview">
      <div className="art-body">{element}</div>
    </div>
  );
}

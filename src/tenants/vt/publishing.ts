import type { TenantPublishing } from "../types";
import { publishingMessages } from "./messages";

/**
 * Publicación de VT Security: series y número de Apuntes en el admin, vista previa
 * con el mismo pipeline que el artículo público y la API /api/v1 (con
 * `features.publicApi`).
 *
 * El render se importa recién al usarlo: el layout del admin y la API solo
 * necesitan los textos y no cargan Shiki ni las figuras.
 */
export const publishing: TenantPublishing = {
  messages: publishingMessages,
  renderPreview: async (markdown) => (await import("./components/Preview")).renderPreview(markdown),
};

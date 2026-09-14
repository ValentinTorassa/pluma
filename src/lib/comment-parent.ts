/** Datos mínimos del comentario al que se quiere responder */
export type ParentCandidate = { articleId: string; status: string } | undefined;

/**
 * Una respuesta solo puede colgar de un comentario que existe, está aprobado
 * y pertenece al mismo artículo. Evita respuestas a comentarios pendientes o
 * rechazados (invisibles) y cruces entre artículos.
 */
export function isValidParent(parent: ParentCandidate, articleId: string): boolean {
  return !!parent && parent.status === "approved" && parent.articleId === articleId;
}

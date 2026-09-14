import type { TenantPublishing } from "../types";

/**
 * Yanina no tiene series, Apuntes ni API de publicación: el admin queda
 * igual que en producción (sin campos ni ítems de menú nuevos) y /api/v1 no existe.
 */
export const publishing: TenantPublishing | null = null;

import type { TenantAgents } from "../types";

/**
 * /llms.txt, /llms-full.txt y /articulo/<slug>.md (src/lib/agents.ts): solo
 * los artículos. Sin Apuntes, sin sección fija y sin figuras.
 */
export const agents: TenantAgents = {
  issuesTitle: null,
  about: null,
  figures: {},
};

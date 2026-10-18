import type { TenantAgents } from "../types";
import { FIGURES } from "./figures/registry";
import { links } from "./links";
import { copy } from "./messages";

/**
 * /llms.txt, /llms-full.txt y /articulo/<slug>.md (src/lib/agents.ts).
 * Los artículos y los envíos de Apuntes los lista el código compartido; acá va
 * la sección de quién escribe, con los mismos links que el sitio.
 */
export const agents: TenantAgents = {
  issuesTitle: copy.nav.apuntes,
  about: {
    title: copy.llms.about,
    links: [
      { title: copy.about.title, url: "/acerca" },
      { title: copy.about.profiles.portfolio, url: links.portfolio },
      { title: copy.about.labsLink, url: links.labs },
      { title: copy.about.profiles.youtube, url: links.youtube },
    ],
  },
  figures: FIGURES,
};

/**
 * Resaltador de Shiki con solo los lenguajes de HIGHLIGHT_LANGUAGES.
 *
 * Es el mismo que arma `shiki` por defecto (motor Oniguruma, mismas
 * gramáticas), pero no conoce el resto: con un lenguaje fuera de la lista,
 * `loadLanguage` falla y rehype-pretty-code vuelve a `plaintext`. Así se ve
 * igual en local que en Vercel, donde esas gramáticas no están (next.config.ts).
 */
import {
  bundledLanguagesInfo,
  createBundledHighlighter,
  createOnigurumaEngine,
  type DynamicImportLanguageRegistration,
} from "shiki";
import { HIGHLIGHT_LANGUAGES } from "./languages";

const allowed = new Set<string>(HIGHLIGHT_LANGUAGES);

// Sin prototipo: un bloque ```constructor no tiene que encontrar nada acá.
const langs: Record<string, DynamicImportLanguageRegistration> = Object.create(null);
for (const info of bundledLanguagesInfo) {
  if (!allowed.has(info.id)) continue;
  for (const name of [info.id, ...(info.aliases ?? [])]) langs[name] = info.import;
}

export const createHighlighter = createBundledHighlighter<string, string>({
  langs,
  themes: {},
  engine: () => createOnigurumaEngine(import("shiki/wasm")),
});

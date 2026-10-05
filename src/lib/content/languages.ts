/**
 * Lenguajes que resalta Shiki, por id (cada uno trae sus alias: `shellscript`
 * cubre bash, sh, shell y zsh). `text`, `txt`, `plaintext` y `plain` no
 * necesitan gramática.
 *
 * Un bloque en un lenguaje que no está acá se ve igual que uno resaltado (mismo
 * marcado, `data-language` incluido), pero sin colores.
 *
 * La lista tiene que estar cerrada: si una gramática embebe a otra (html a
 * javascript y css, nginx a c y lua), esa otra también va acá. Si no, un bloque
 * de lua saldría con o sin colores según lo que se haya resaltado antes en el
 * mismo proceso. Lo controla tests/unit/content.test.ts.
 *
 * next.config.ts lee este archivo para dejar fuera de las funciones las demás
 * gramáticas de @shikijs/langs, así que no puede importar nada.
 */
export const HIGHLIGHT_LANGUAGES = [
  // Terminal y sistema
  "shellscript", // bash, sh, shell, zsh
  "shellsession", // console
  "powershell", // ps, ps1, pwsh
  "docker", // dockerfile
  "nginx",
  "systemd",
  "ssh-config",
  "dotenv",
  "ini", // properties
  "toml",
  "yaml", // yml
  "log",
  "diff",
  // Datos y código
  "json",
  "sql",
  "python", // py
  "javascript", // js, cjs, mjs
  "typescript", // ts, cts, mts
  "go",
  "rust", // rs
  "c",
  "lua", // la embebe nginx
  "html",
  "css",
  "markdown", // md
] as const;

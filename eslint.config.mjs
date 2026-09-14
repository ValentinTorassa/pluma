import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Un tenant no puede importar `@tenant/*`: en typecheck apunta a yanina y
  // en build al tenant activo. Dentro de src/tenants/ se usan imports relativos.
  {
    files: ["src/tenants/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tenant", "@tenant/*"],
              message: "Dentro de src/tenants/ usá imports relativos, no @tenant/*.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

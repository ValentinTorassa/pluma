import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

/**
 * Multi-instancia: cada deployment (proyecto de Vercel) elige su tenant en
 * BUILD con PLUMA_TENANT (por defecto "yanina" = producción actual).
 * `@tenant/*` apunta a src/tenants/<tenant>/ para JS/TS (Turbopack y webpack)
 * y para CSS (`@import "@tenant/theme.css"` en globals.css).
 */
const tenant = process.env.PLUMA_TENANT ?? "yanina";
const tenantsDir = join(process.cwd(), "src", "tenants");
const knownTenants = readdirSync(tenantsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (!/^[a-z0-9-]+$/.test(tenant) || !knownTenants.includes(tenant)) {
  throw new Error(
    `PLUMA_TENANT="${tenant}" no es un tenant conocido. Opciones: ${knownTenants.join(", ")} (carpetas en src/tenants/).`,
  );
}

const REQUIRED_FILES = [
  "index.ts",
  "config.ts",
  "messages.ts",
  "fonts.ts",
  "theme.css",
  "Logo.tsx",
  "og.tsx",
  "icon.svg",
  "slots/Header.tsx",
  "slots/HomeHero.tsx",
  "slots/ArticleCard.tsx",
  "slots/Footer.tsx",
  "theme-script.ts",
  "pages/home.tsx",
  "pages/article.tsx",
  "pages/series.tsx",
  "pages/apuntes.tsx",
];
const missing = REQUIRED_FILES.filter((f) => !existsSync(join(tenantsDir, tenant, f)));
if (missing.length > 0) {
  throw new Error(`El tenant "${tenant}" está incompleto. Faltan: ${missing.join(", ")}`);
}

const tsconfigPath = tenant === "yanina" ? "tsconfig.json" : `tsconfig.${tenant}.json`;
if (!existsSync(join(process.cwd(), tsconfigPath))) {
  throw new Error(`Falta ${tsconfigPath} (paths de @tenant/* para el tenant "${tenant}").`);
}

/**
 * app/icon.svg se genera desde el tenant: un icon.svg estático conserva la URL
 * y el hash (`/icon.svg?icon.<hash>.svg`) que ya sirve producción. Está en
 * .gitignore; se copia solo si cambió para no disparar recargas en dev.
 */
const iconSource = join(tenantsDir, tenant, "icon.svg");
const iconTarget = join(process.cwd(), "src", "app", "icon.svg");
if (!existsSync(iconTarget) || !readFileSync(iconTarget).equals(readFileSync(iconSource))) {
  copyFileSync(iconSource, iconTarget);
}

/**
 * app/not-found.tsx también se genera: solo existe si el tenant define
 * pages/not-found.tsx. Un tenant sin página propia (yanina) conserva el 404
 * por defecto de Next.js, igual que en producción. Está en .gitignore.
 */
const notFoundSource = join(tenantsDir, tenant, "pages", "not-found.tsx");
const notFoundTarget = join(process.cwd(), "src", "app", "not-found.tsx");
const notFoundModule =
  '// Generado por next.config.ts desde src/tenants/<tenant>/pages/not-found.tsx. No editar.\nexport { default } from "@tenant/pages/not-found";\n';
if (existsSync(notFoundSource)) {
  if (!existsSync(notFoundTarget) || readFileSync(notFoundTarget, "utf8") !== notFoundModule) {
    writeFileSync(notFoundTarget, notFoundModule);
  }
} else if (existsSync(notFoundTarget)) {
  rmSync(notFoundTarget);
}

/**
 * Rutas de features: viven en src/feature-routes/ y se copian a src/app/ solo
 * si el tenant activa la feature (generadas, en .gitignore). Así un tenant sin
 * la feature no tiene la ruta: /feed.xml o /serie/x siguen dando el mismo 404
 * de ruta inexistente que antes, no un notFound() dentro de un segmento.
 */
const FEATURE_ROUTES: Record<string, string[]> = {
  series: ["(public)/series/page.tsx", "(public)/serie/[slug]/page.tsx"],
  apuntes: ["(public)/apuntes/page.tsx", "(public)/apuntes/[numero]/page.tsx"],
  rss: ["feed.xml/route.ts"],
  newsletter: ["api/newsletter/route.ts"],
};
// El config del tenant solo importa tipos: el require hook de next.config.ts lo transpila
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tenantFeatures: Record<string, boolean> = require(join(tenantsDir, tenant, "config.ts")).config.features;
for (const [feature, files] of Object.entries(FEATURE_ROUTES)) {
  for (const file of files) {
    const target = join(process.cwd(), "src", "app", file);
    if (tenantFeatures[feature]) {
      const content = `// Generado por next.config.ts desde src/feature-routes/${file} (feature "${feature}"). No editar.\n${readFileSync(join(process.cwd(), "src", "feature-routes", file), "utf8")}`;
      if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    } else if (existsSync(target)) {
      rmSync(target);
    }
  }
}

/**
 * Headers de seguridad para todas las rutas. La CSP estricta con nonce la
 * pone src/proxy.ts; acá va una CSP base que no puede romper el render
 * (no restringe scripts ni estilos) y se aplica también a API y assets.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: { tsconfigPath },
  turbopack: {
    resolveAlias: {
      "@tenant": `./src/tenants/${tenant}`,
    },
  },
  webpack: (config) => {
    config.resolve.alias["@tenant"] = join(tenantsDir, tenant);
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

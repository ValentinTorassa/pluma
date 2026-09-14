import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

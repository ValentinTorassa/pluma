import type { Metadata } from "next";
import { headers } from "next/headers";
import { config } from "@tenant/config";
import { fontVariables } from "@tenant/fonts";
// Entrada CSS del tenant: importa ./globals.css y le suma los tokens del tenant
import "@tenant/theme.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${config.siteName} — ${config.author.name}`,
    template: `%s · ${config.siteName}`,
  },
  description: config.siteDescription,
  openGraph: {
    siteName: config.siteName,
    locale: config.locale,
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce de la CSP (lo genera src/proxy.ts) para el script inline del tema
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={config.lang}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <head>
        <script
          nonce={nonce}
          // el navegador vacía el atributo nonce al parsear: no es un mismatch real
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(`${config.storagePrefix}:theme`)})==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

/**
 * Chequeo de tipos del tenant: si falta un módulo o no cumple el contrato,
 * `tsc` falla. El código compartido NO importa este archivo.
 */
import type { TenantModule } from "../types";
import { config } from "./config";
import { fontVariables } from "./fonts";
import { Logo } from "./Logo";
import { messages } from "./messages";
import { og } from "./og";
import { acercaPage } from "./pages/acerca";
import { articlePage } from "./pages/article";
import { homePage } from "./pages/home";
import { issuePage, apuntesPage } from "./pages/apuntes";
import { seriesIndexPage, seriesPage } from "./pages/series";
import { publishing } from "./publishing";
import { ArticleCard } from "./slots/ArticleCard";
import { Footer } from "./slots/Footer";
import { Header } from "./slots/Header";
import { HomeHero } from "./slots/HomeHero";
import { themeInitScript } from "./theme-script";

export const tenant = {
  config,
  messages,
  fontVariables,
  themeInitScript,
  Logo,
  og,
  slots: { Header, HomeHero, ArticleCard, Footer },
  pages: {
    home: homePage,
    about: acercaPage,
    article: articlePage,
    seriesIndex: seriesIndexPage,
    series: seriesPage,
    apuntes: apuntesPage,
    issue: issuePage,
  },
  publishing,
} satisfies TenantModule;

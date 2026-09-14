/**
 * Chequeo de tipos del tenant: si falta un módulo o no cumple el contrato,
 * `tsc` falla. El código compartido NO importa este archivo (importa cada
 * módulo por separado vía `@tenant/*` para no mezclar server y client).
 */
import type { TenantModule } from "../types";
import { config } from "./config";
import { fontVariables } from "./fonts";
import { Logo } from "./Logo";
import { messages } from "./messages";
import { og } from "./og";
import { ArticleCard } from "./slots/ArticleCard";
import { Footer } from "./slots/Footer";
import { Header } from "./slots/Header";
import { HomeHero } from "./slots/HomeHero";

export const tenant = {
  config,
  messages,
  fontVariables,
  Logo,
  og,
  slots: { Header, HomeHero, ArticleCard, Footer },
} satisfies TenantModule;

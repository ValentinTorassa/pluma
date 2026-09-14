/**
 * Contrato que implementa cada tenant en src/tenants/<tenant>/.
 *
 * El código compartido importa el tenant activo con el alias `@tenant/*`
 * (se resuelve en build según PLUMA_TENANT, ver next.config.ts). Los archivos
 * de un tenant NUNCA importan `@tenant/*`: usan imports relativos entre sí y
 * `@/…` para el código compartido.
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import type { Article } from "@/db/schema";
import type { SiteSettings } from "@/lib/settings";

export type TenantFeatures = {
  /** Resaltado de sintaxis en bloques de código (Shiki) */
  codeHighlight: boolean;
  /** Directivas en el Markdown (`::figure`, `:::aside`, marcas en línea) */
  callouts: boolean;
  /** /feed.xml */
  rss: boolean;
  /** Artículos agrupados en series (/series, /serie/[slug]) */
  series: boolean;
  /** Formulario de suscripción (POST /api/newsletter → NEWSLETTER_SUBSCRIBE_URL) */
  newsletter: boolean;
  /** Envíos del newsletter publicados como artículos (/apuntes) */
  apuntes: boolean;
  publicApi: boolean;
  /** Barra de progreso de lectura y botón "volver arriba" en los artículos */
  readingTools: boolean;
};

export type TenantConfig = {
  /** Identificador del tenant (= nombre de la carpeta y valor de PLUMA_TENANT) */
  id: string;
  /** Nombre del sitio (aparece en el header, título y SEO) */
  siteName: string;
  /** Descripción corta para SEO y el header */
  siteDescription: string;
  /** Locale para Intl (fechas) y Open Graph */
  locale: string;
  /** Atributo lang del <html> */
  lang: string;
  /** Zona horaria del sitio (agrupa el archivo por mes). El servidor corre en UTC. */
  timeZone: string;
  author: {
    name: string;
    role: string;
    bio: string;
    /** URL de foto de perfil (opcional) */
    avatarUrl: string;
    email: string;
    linkedin: string;
  };
  /** Cantidad de artículos por página en el home */
  pageSize: number;
  /** Palabras/frases prohibidas en comentarios (se rechazan automáticamente) */
  commentBlacklist: readonly string[];
  /** Prefijo de las claves de localStorage (`<prefix>:theme`, `<prefix>:font`, …) */
  storagePrefix: string;
  /** Carpeta (con barra final) donde se suben las imágenes a Vercel Blob */
  blobPrefix: string;
  /** Nombre de la cookie de sesión del admin */
  sessionCookie: string;
  features: TenantFeatures;
};

/* ---------- Slots: componentes cuyo layout cambia por tenant ---------- */

export type HeaderProps = { siteName: string };
export type HomeHeroProps = { site: SiteSettings };
export type ArticleCardProps = { article: Article; upvotes: number; commentCount: number };
export type FooterProps = { site: SiteSettings; siteName: string };
export type LogoProps = { className?: string };

type Slot<P> = (props: P) => ReactElement | null | Promise<ReactElement | null>;

/* ---------- Open Graph ---------- */

export type OgSize = { width: number; height: number };

export type TenantOg = {
  /** alt de /opengraph-image */
  alt: string;
  size: OgSize;
  /** Imagen OG del sitio (home) */
  site: (site: SiteSettings) => ReactElement;
  /** Imagen OG de un artículo */
  article: (title: string, site: SiteSettings) => ReactElement;
};

/* ---------- Páginas ---------- */

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Una página completa del tenant. Las rutas de src/app/ son envoltorios finos
 * que leen params y delegan acá (render + metadata).
 */
export type TenantPage<P> = {
  Page: Slot<P>;
  metadata: (props: P) => Promise<Metadata>;
};

/**
 * Cada archivo de src/tenants/<tenant>/pages/ exporta sus páginas. Las de una
 * feature que el tenant no tiene se exportan como `null` y la ruta responde 404.
 *
 *   pages/home.tsx      → homePage
 *   pages/article.tsx   → articlePage
 *   pages/series.tsx    → seriesIndexPage, seriesPage   (feature `series`)
 *   pages/apuntes.tsx  → apuntesPage, issuePage       (feature `apuntes`)
 *   pages/not-found.tsx → default export (opcional; next.config.ts genera app/not-found.tsx)
 */
export type TenantPages = {
  home: TenantPage<{ searchParams: SearchParams }>;
  article: TenantPage<{ slug: string }>;
  seriesIndex: TenantPage<Record<string, never>> | null;
  series: TenantPage<{ slug: string }> | null;
  apuntes: TenantPage<Record<string, never>> | null;
  issue: TenantPage<{ number: string }> | null;
};

/**
 * Forma completa de un tenant: la verifica src/tenants/<tenant>/index.ts con
 * `satisfies`. Además de estos módulos, cada tenant tiene `theme.css` (tokens
 * Tailwind) e `icon.svg` (next.config.ts lo copia a src/app/icon.svg).
 */
export type TenantModule = {
  config: TenantConfig;
  messages: Messages;
  fontVariables: string;
  /** Script inline (con nonce) que aplica el tema guardado antes de pintar (theme-script.ts) */
  themeInitScript: string;
  Logo: Slot<LogoProps>;
  og: TenantOg;
  slots: {
    Header: Slot<HeaderProps>;
    HomeHero: Slot<HomeHeroProps>;
    ArticleCard: Slot<ArticleCardProps>;
    Footer: Slot<FooterProps>;
  };
  pages: TenantPages;
};

/* ---------- Textos de la UI y de la API ---------- */

/** Singular/plural según cantidad */
export type Plural = { one: string; other: string };

export type Messages = {
  nav: {
    articles: string;
    archive: string;
    about: string;
    aboutLong: string;
    search: string;
    openMenu: string;
    closeMenu: string;
  };
  header: { tagline: string };
  theme: { light: string; dark: string };
  reader: { more: string; smaller: string; bigger: string; print: string };
  searchBox: { label: string; placeholder: string };
  backToTop: string;
  footer: { contact: string; linkedin: string };
  home: {
    kicker: string;
    followLinkedin: string;
    taggedWith: string;
    showAll: string;
    empty: string;
    newer: string;
    older: string;
    page: string;
    of: string;
  };
  card: { minutesRead: string; readArticle: string; votes: string; comments: string };
  relativeTime: {
    justNow: string;
    /** Prefijo ("hace") */
    ago: string;
    min: string;
    hours: string;
    days: Plural;
    months: Plural;
  };
  article: {
    minutesRead: string;
    comments: string;
    related: string;
    toc: string;
  };
  share: { label: string; linkedin: string; whatsapp: string; copy: string; copied: string };
  upvote: { voted: string; notVoted: string };
  comments: {
    empty: string;
    title: string;
    moderationNote: string;
    namePlaceholder: string;
    contentPlaceholder: string;
    sending: string;
    submit: string;
    reply: string;
    cancel: string;
    inReply: string;
  };
  search: {
    title: string;
    tooShort: string;
    /** Se arma como `${noResults}“${query}”.` */
    noResults: string;
    results: Plural;
  };
  archive: {
    title: string;
    intro: string;
    empty: string;
    back: string;
    articles: Plural;
  };
  about: { title: string; descriptionPrefix: string; email: string; linkedin: string };
  admin: {
    brand: string;
    brandSuffix: string;
    login: {
      metaTitle: string;
      title: string;
      subtitle: string;
      username: string;
      password: string;
      submitting: string;
      submit: string;
    };
    nav: { articles: string; comments: string; settings: string; viewSite: string; logout: string };
    confirmCancel: string;
    articles: {
      title: string;
      newArticle: string;
      empty: string;
      columns: { title: string; status: string; tags: string; updated: string; actions: string };
      published: string;
      draft: string;
      view: string;
      unpublish: string;
      publish: string;
      delete: string;
      deleteConfirm: string;
      editTitle: string;
      newTitle: string;
    };
    form: {
      title: string;
      titlePlaceholder: string;
      slug: string;
      slugHint: string;
      slugPlaceholder: string;
      excerpt: string;
      excerptHint: string;
      excerptPlaceholder: string;
      tags: string;
      tagsHint: string;
      tagsPlaceholder: string;
      cover: string;
      uploading: string;
      changeImage: string;
      uploadImage: string;
      remove: string;
      coverAlt: string;
      content: string;
      saveDraft: string;
      keepPublished: string;
      publish: string;
      uploadFailed: string;
    };
    editor: {
      boldPlaceholder: string;
      italicPlaceholder: string;
      h2Placeholder: string;
      h3Placeholder: string;
      linkPlaceholder: string;
      link: string;
      quote: string;
      quotePlaceholder: string;
      list: string;
      listPlaceholder: string;
      image: string;
      edit: string;
      preview: string;
      emptyPreview: string;
      contentPlaceholder: string;
    };
    comments: {
      title: string;
      empty: string;
      inArticle: string;
      approve: string;
      remove: string;
      footnote: string;
    };
    settings: {
      title: string;
      intro: string;
      avatar: string;
      changePhoto: string;
      uploadPhoto: string;
      pasteUrl: string;
      name: string;
      role: string;
      roleHint: string;
      description: string;
      descriptionHint: string;
      bio: string;
      bioHint: string;
      email: string;
      linkedin: string;
      saved: string;
      saving: string;
      save: string;
    };
  };
  errors: {
    tooManyLogins: string;
    badCredentials: string;
    titleRequired: string;
    publishWithoutContent: string;
  };
  api: {
    invalidRequest: string;
    commentInvalid: string;
    commentLinks: string;
    articleNotFound: string;
    replyInvalid: string;
    commentsUnavailable: string;
    commentTooSoon: string;
    commentThanks: string;
    invalidBody: string;
    articleNotFoundShort: string;
    votesUnavailable: string;
    tooManyVotes: string;
    unauthorized: string;
    missingFile: string;
    invalidImageType: string;
    /** `${imageTooLarge}${MAX_SIZE_MB}MB` */
    imageTooLarge: string;
    newsletterInvalid: string;
    newsletterUnavailable: string;
    newsletterTooMany: string;
    newsletterFailed: string;
    newsletterThanks: string;
  };
};

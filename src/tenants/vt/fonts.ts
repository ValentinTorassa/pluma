import { IBM_Plex_Mono, Instrument_Sans, Newsreader } from "next/font/google";

/** Títulos y textos editoriales */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

/** Texto de interfaz y cuerpo */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

/** Código */
const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** Clases con las variables CSS de las fuentes, para el <html> */
export const fontVariables = `${newsreader.variable} ${instrumentSans.variable} ${plexMono.variable}`;

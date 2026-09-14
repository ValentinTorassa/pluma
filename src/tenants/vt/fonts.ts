import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";

// TODO(phase4): revisar pesos/subsets definitivos.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/** Clases con las variables CSS de las fuentes, para el <html> */
export const fontVariables = `${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`;

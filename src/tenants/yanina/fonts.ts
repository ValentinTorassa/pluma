import { Geist, Lora } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

/** Clases con las variables CSS de las fuentes, para el <html> */
export const fontVariables = `${geistSans.variable} ${lora.variable}`;

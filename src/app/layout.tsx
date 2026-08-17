import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Three roles, each earning its place. Archivo Expanded for structure, Source
// Serif for prose (answer explanations are the pedagogical heart of a study
// tool and should read like a book), JetBrains Mono for anything measured.
// Variable weight is required to also load the width axis, which is what gives
// the display face its expanded, engineered feel.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  weight: "variable",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Readiness — CCA-F practice and progress tracking",
    template: "%s — Readiness",
  },
  description:
    "Practice questions for the Anthropic Claude Certified Architect Foundations exam, with a per-domain breakdown and an estimated score out of 1000.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Font variables go on <html> so the theme tokens that reference them
    // resolve at :root, where Tailwind defines them.
    <html lang="en" className={`${archivo.variable} ${sourceSerif.variable} ${jetbrains.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

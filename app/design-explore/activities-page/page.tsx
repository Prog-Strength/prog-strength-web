import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Archivo, IBM_Plex_Mono, Inter, Manrope } from "next/font/google";
import { config } from "@/lib/config";
import { ComparisonClient } from "./comparison-client";

/**
 * Design Exploration comparison route — activities-page.
 *
 * THROWAWAY / DO-NOT-MERGE. Renders all five design variants of the
 * Activities surface on one screen so a human can compare and pick a
 * direction. This is a divergent exploration, not a spec — see
 * dx/activities-page.md in prog-strength-docs.
 *
 * Gated behind `config.designExploreEnabled` (NEXT_PUBLIC_DESIGN_EXPLORE=1)
 * so it is unreachable in normal product navigation and dead in production:
 * with the flag off the route 404s like any unknown path.
 *
 * Lives OUTSIDE the (app) route group on purpose — it is a full-bleed design
 * canvas, not an authenticated product surface, so it skips the shared
 * sidebar shell. Each variant brings its own type family (greenfield scope):
 * the fonts below are scoped to this route via CSS-variable classes and never
 * touch the global layout.
 */

const fraunces = Fraunces({ subsets: ["latin"], variable: "--dx-font-fraunces", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--dx-font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--dx-font-plex-mono",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--dx-font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--dx-font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "DX · activities-page · 5 variants",
  robots: { index: false, follow: false },
};

export default function DesignExploreActivitiesPage() {
  if (!config.designExploreEnabled) {
    notFound();
  }

  const fontVars = [
    fraunces.variable,
    archivo.variable,
    plexMono.variable,
    inter.variable,
    manrope.variable,
  ].join(" ");

  return (
    <div className={fontVars} style={{ background: "#0c0d10", minHeight: "100vh" }}>
      <ComparisonClient />
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { ComparisonView } from "./_view";

/**
 * Design Exploration (DX) comparison route — throwaway.
 *
 * Renders all five bodyweight-page variants side by side for a human to
 * compare and pick a direction (see prog-strength-docs/dx/bodyweight-page.md).
 * It lives OUTSIDE the (app) route group, so it carries no sidebar and no
 * auth gate, and is hidden behind the NEXT_PUBLIC_DESIGN_EXPLORE flag
 * (lib/config.ts) so it is dead in production and unreachable from normal
 * navigation. NEVER link to this from product UI; it is reimplemented for
 * real by a downstream SOW once a variant is chosen.
 */

export const metadata: Metadata = {
  title: "DX · Bodyweight page",
  robots: { index: false, follow: false },
};

export default function DesignExploreBodyweightPage() {
  if (!config.designExplore) notFound();
  return <ComparisonView />;
}

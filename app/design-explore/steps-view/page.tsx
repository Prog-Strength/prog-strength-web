import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { Comparison } from "./_comparison";

/**
 * Design-exploration comparison route — /design-explore/steps-view.
 *
 * THROWAWAY. Renders five side-by-side visual variants of the Steps tab of
 * /activities for a human to compare and pick a direction. It is never
 * linked from product navigation and never merged. It is gated behind
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE (see lib/config.ts) so a normal build —
 * and production, where the var is unset — 404s it. The chosen variant is
 * reimplemented properly by a downstream SOW.
 *
 * See prog-strength-docs/dx/steps-view.md.
 */
export const metadata: Metadata = {
  title: "DX · steps-view",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!config.designExploreEnabled) notFound();
  return <Comparison />;
}

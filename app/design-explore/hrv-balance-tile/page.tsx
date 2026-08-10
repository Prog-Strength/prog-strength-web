/**
 * DX comparison route — /design-explore/hrv-balance-tile
 *
 * Renders the five hrv-balance-tile variants side by side for the selection
 * gate. Gated by the ONE standard DX flag (`config.designExploreEnabled`,
 * backed by the single env var NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE): unset in
 * production so the route 404s, truthy on the Vercel preview deploy where
 * variants are reviewed. Throwaway — additive and purely flag-gated; it touches
 * no production route, component, or data path.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { HrvBalanceTileExplore } from "./_client";

export default function HrvBalanceTileDesignExplorePage() {
  if (!config.designExploreEnabled) notFound();
  return <HrvBalanceTileExplore />;
}

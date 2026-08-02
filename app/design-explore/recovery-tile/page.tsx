/**
 * DX comparison route — /design-explore/recovery-tile
 *
 * Renders the five recovery-tile variants side by side for the selection gate.
 * Gated by the ONE standard DX flag (`config.designExploreEnabled`, backed by
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE): unset in production so the route 404s,
 * truthy on the Vercel preview deploy where variants are reviewed. Throwaway —
 * additive, purely flag-gated, touches no production route or component.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { RecoveryTileExplore } from "./_client";

export default function RecoveryTileDesignExplorePage() {
  if (!config.designExploreEnabled) notFound();
  return <RecoveryTileExplore />;
}

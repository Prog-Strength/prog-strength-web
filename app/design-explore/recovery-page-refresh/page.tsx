/**
 * DX comparison route: `/design-explore/recovery-page-refresh` — THROWAWAY.
 *
 * Gated by THE single Design Exploration flag, `config.designExploreEnabled`
 * (backed by `NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE`, and shared by every DX
 * surface). Unset in production, so this route 404s there; set truthy on a
 * Vercel preview deploy when a reviewer wants to compare the variants.
 *
 * Purely additive and never merged. It touches no production route, no shipped
 * component, and no data service — the variants render static fixtures.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { Comparison } from "./_comparison";

export default function RecoveryPageRefreshDesignExplorePage() {
  if (!config.designExploreEnabled) notFound();

  return <Comparison />;
}

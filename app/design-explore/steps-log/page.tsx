import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { StepsLogComparison } from "./_comparison";

/**
 * DX comparison route — /design-explore/steps-log.
 *
 * Throwaway, additive, and gated by THE single shared DX flag
 * (`config.designExploreEnabled`, backed by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE):
 * unset in production so this route 404s, set truthy on a Vercel preview so a
 * reviewer can compare the five steps-log variants side by side and pick a
 * direction. Never merged; the winner is reimplemented by a downstream SOW.
 */
export default function StepsLogDesignExplorePage() {
  if (!config.designExploreEnabled) notFound();
  return <StepsLogComparison />;
}

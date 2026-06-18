import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import Explorer from "./_explorer";

/**
 * Throwaway design-exploration comparison route for `calendar-day-detail`.
 *
 * Renders five idiom variants of the day-detail surface side by side for a
 * human selection gate (see prog-strength-docs/dx/calendar-day-detail.md).
 * It is GATED behind `config.designExploreEnabled` (NEXT_PUBLIC_DESIGN_EXPLORE
 * === "1") so it is unreachable in normal navigation and dead in production —
 * the route 404s unless the flag is explicitly set on a preview deploy. It is
 * deliberately outside the (app) route group: no auth shell, no sidebar entry,
 * never linked from product navigation. NOT production code — do not promote.
 */
export default function CalendarDayDetailDX() {
  if (!config.designExploreEnabled) notFound();
  return <Explorer />;
}

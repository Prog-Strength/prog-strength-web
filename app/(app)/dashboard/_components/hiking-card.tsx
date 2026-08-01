/**
 * HikingCard — the dashboard's hiking endurance mini-card.
 *
 * Mirrors RunningCard's grammar: a BigNum headline (this week's distance),
 * a Spark of the weekly-distance trend, and a MetaRow secondary (hikes ·
 * elevation · time · last). Unlike walking/cycling, hiking is a discipline,
 * so the spark stroke uses the hike discipline dot token; the secondary
 * surfaces elevation gain via the shared elevation formatter. A
 * `present: false` section degrades to an inviting empty CTA.
 */

import type { DashboardData } from "@/lib/dashboard";
import { MiniCard, MiniCardEmpty } from "./mini-card";
import { BigNum } from "./big-num";
import { Spark } from "./spark";
import { MetaRow } from "./meta-row";
import { compact } from "./compact";
import { formatDuration } from "@/lib/format";
import { formatElevationValue } from "@/lib/distance-unit-context";

export function HikingCard({ section, href }: { section: DashboardData["hiking"]; href: string }) {
  if (!section.present) {
    return (
      <MiniCard title="Hiking" href={href}>
        <MiniCardEmpty cta="Log a hike to start tracking" />
      </MiniCard>
    );
  }
  const v = section;
  return (
    <MiniCard title="Hiking" href={href}>
      <BigNum value={v.currentWeek.distance} suffix={`${v.unit} this week`} />
      <Spark points={v.spark.points} className="h-7 w-full text-[var(--discipline-hike-dot)]" />
      <MetaRow
        items={[
          { label: "hikes", value: compact(v.currentWeek.sessionCount) },
          { label: "elevation", value: formatElevationValue(v.elevationGainMeters, v.unit) },
          { label: "time", value: formatDuration(v.durationSeconds) },
          { label: "last", value: v.latest ? `${v.latest.distance} ${v.unit}` : null },
        ]}
      />
    </MiniCard>
  );
}

/**
 * CyclingCard — the dashboard's cycling endurance mini-card.
 *
 * Mirrors RunningCard's grammar: a BigNum headline (this week's distance),
 * a Spark of the weekly-distance trend, and a MetaRow secondary (rides ·
 * time · last). Cycling is a DATA metric with no discipline hue, so the
 * spark stroke is a calm `--muted` (never `--accent`). A `present: false`
 * section degrades to an inviting empty CTA into the deep page.
 */

import type { DashboardData } from "@/lib/dashboard";
import { MiniCard, MiniCardEmpty } from "./mini-card";
import { BigNum } from "./big-num";
import { Spark } from "./spark";
import { MetaRow } from "./meta-row";
import { compact } from "./compact";
import { formatDuration } from "@/lib/format";

export function CyclingCard({
  section,
  href,
}: {
  section: DashboardData["cycling"];
  href: string;
}) {
  if (!section.present) {
    return (
      <MiniCard title="Cycling" href={href}>
        <MiniCardEmpty cta="Log a ride to start tracking" />
      </MiniCard>
    );
  }
  const v = section;
  return (
    <MiniCard title="Cycling" href={href}>
      <BigNum value={v.currentWeek.distance} suffix={`${v.unit} this week`} />
      <Spark points={v.spark.points} className="h-7 w-full text-[var(--muted)]" />
      <MetaRow
        items={[
          { label: "rides", value: compact(v.currentWeek.sessionCount) },
          { label: "time", value: formatDuration(v.durationSeconds) },
          { label: "last", value: v.latest ? `${v.latest.distance} ${v.unit}` : null },
        ]}
      />
    </MiniCard>
  );
}

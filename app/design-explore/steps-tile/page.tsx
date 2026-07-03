/**
 * Design Exploration comparison route — steps-tile.  DO NOT MERGE.
 *
 * A throwaway, flag-gated screen that renders all five steps-tile variants
 * side by side at true tile width, each across the full / no-goal / sparse
 * fixtures so the degraded states are visible. It is purely additive: no
 * production route, component, or data path is touched. Gated by the ONE
 * standard DX flag (`config.designExploreEnabled`, backed by
 * `NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE`) — unset in prod (404), truthy on the
 * Vercel preview deploy where variants are reviewed.
 *
 * scope: in-system — every variant wears the v0.4 oura-calm tokens (near-black
 * ramp, single periwinkle accent, Manrope + tabular figures, desaturated
 * success/muted). The spread is in LAYOUT / STRUCTURE / DENSITY only.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { FULL, NO_GOAL, SPARSE, type StepsFixture } from "./_fixtures";
import { DxTile, DxTileEmpty, TILE_WIDTH } from "./_shell";
import { MicroBarsGoalLine } from "./_variants/micro-bars-goal-line";
import { GoalHitColumns } from "./_variants/goal-hit-columns";
import { DualBaselineEditorial } from "./_variants/dual-baseline-editorial";
import { ProgressMeter } from "./_variants/progress-meter";
import { DailyLedger } from "./_variants/daily-ledger";

type Variant = {
  id: string;
  name: string;
  drawsOn: string;
  distinct: string;
  Component: (props: { fixture: StepsFixture }) => React.ReactNode;
};

// Ticket order.
const VARIANTS: Variant[] = [
  {
    id: "micro-bars-goal-line",
    name: "micro-bars-goal-line",
    drawsOn:
      "Apple Fitness / Gentler Streak — goal-relative day bars crossed by a dashed goal line",
    distinct:
      "one big “16k today” figure over seven linear-scaled bars; success = cleared, muted = under, accent = today",
    Component: MicroBarsGoalLine,
  },
  {
    id: "goal-hit-columns",
    name: "goal-hit-columns",
    drawsOn:
      "GitHub contribution row + Gentler Streak — the sibling StreakCard's outcome-cell idiom",
    distinct:
      "no y-axis; a `5/7 hit` ratio over outcome-coloured cells — color, not height, is the read",
    Component: GoalHitColumns,
  },
  {
    id: "dual-baseline-editorial",
    name: "dual-baseline-editorial",
    drawsOn:
      "The Athletic — an authored oversized headline figure with the chart demoted to a caption",
    distinct:
      "huge tabular avg with today as a delta chip; faint bars, meaning carried by the avg (accent) + goal (success) baselines",
    Component: DualBaselineEditorial,
  },
  {
    id: "progress-meter",
    name: "progress-meter",
    drawsOn:
      "Apple Fitness rings — goal-as-shape, shrunk to tile scale (previews the deep page's goal-ring-hero)",
    distinct:
      "a centred ring, its centre number the size anchor; accent fill flips to success once at/over goal",
    Component: ProgressMeter,
  },
  {
    id: "daily-ledger",
    name: "daily-ledger",
    drawsOn: "Robinhood — sparkline list rows: an inline per-row mini-bar + delta",
    distinct:
      "no chart; a dense stack of dated rows, accent/success spent only on the goal-delta sign + inline bar",
    Component: DailyLedger,
  },
];

const FIXTURES: { label: string; fixture: StepsFixture }[] = [
  { label: "Goal set · today over it", fixture: FULL },
  { label: "No goal set", fixture: NO_GOAL },
  { label: "Brand-new / sparse", fixture: SPARSE },
];

export default function StepsTileDesignExplore() {
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="min-h-full bg-[var(--background)] px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Design Exploration · DO NOT MERGE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Steps tile — 5 variants
          </h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            The dashboard Steps mini-card, explored five ways. Each idiom heroes a different element
            — today&apos;s bars, hit-consistency, the average, goal progress, the daily log — so the
            pick is a real choice, not a coin-flip between accent colours. All five are in-system
            (v0.4 oura-calm: near-black, periwinkle accent, Manrope, tabular figures) and diverge
            only on layout, structure, density, and composition. Every variant is shown at true tile
            width across the full / no-goal / sparse fixtures.
          </p>
        </header>

        {VARIANTS.map(({ id, name, drawsOn, distinct, Component }, i) => (
          <section key={id} id={id} className="flex flex-col gap-4 scroll-mt-6">
            <div className="flex flex-col gap-1">
              <h2 className="flex items-baseline gap-2 text-lg font-semibold text-[var(--foreground)]">
                <span className="font-mono text-sm text-[var(--faint)]">{i + 1}</span>
                <span className="font-mono">{name}</span>
              </h2>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--foreground)]">Draws on</span> {drawsOn}
              </p>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--foreground)]">Distinct because</span> {distinct}
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              {FIXTURES.map(({ label, fixture }) => (
                <div key={label} className={`flex flex-col gap-2 ${TILE_WIDTH}`}>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">
                    {label}
                  </span>
                  <DxTile>
                    <Component fixture={fixture} />
                  </DxTile>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Shared fully-empty fallback — identical for every variant. */}
        <section className="flex flex-col gap-4 border-t border-[var(--border)] pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Shared empty state</h2>
            <p className="text-sm text-[var(--muted)]">
              A fully-empty user (<span className="font-mono">present: false</span>) falls back to
              the grid&apos;s shared <span className="font-mono">MiniCardEmpty</span> CTA for every
              variant — matching its five neighbours.
            </p>
          </div>
          <div className={TILE_WIDTH}>
            <DxTileEmpty />
          </div>
        </section>
      </div>
    </main>
  );
}

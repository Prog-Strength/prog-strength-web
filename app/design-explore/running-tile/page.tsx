/**
 * DX comparison route — dx/running-tile. THROWAWAY, NEVER SHIPS.
 *
 * Renders all six running-tile variants side by side, each across the four
 * ticket-mandated fixture states (ordinary / zero runs / first run ever /
 * indoor only), with a mi↔km toggle and two pair-in-grid mocks beside the
 * real Walking and Steps cards — because judging these tiles in isolation is
 * exactly the mistake this DX exists to correct.
 *
 * Gated by the ONE standard DX flag (`config.designExploreEnabled`, backed by
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE): unset in production, so this route
 * 404s; set truthy on a Vercel preview deploy to compare variants.
 *
 * Lives OUTSIDE the (app) auth shell on purpose: the variants are static
 * fixtures, and a reviewer on a preview deploy shouldn't need a login or a
 * running API to compare compositions.
 */
"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { METERS_PER_KM, METERS_PER_MILE, type DistanceUnit } from "@/lib/distance-unit-context";
import type { Section, StepsView, WalkingView } from "@/lib/dashboard";
import { WalkingCard } from "@/app/(app)/dashboard/_components/walking-card";
import { StepsCard } from "@/app/(app)/dashboard/_components/tile-renderer";
import { ALL_FIXTURES, ORDINARY_WEEK, type DxRunningFixture } from "./_components/fixtures";
import { StackedWeekCard } from "./_components/stacked-week";
import { WeekLogCard } from "./_components/week-log";
import { PaceBandCard } from "./_components/pace-band";
import { EffortHeartCard } from "./_components/effort-heart";
import { VerticalGainCard } from "./_components/vertical-gain";
import { LoadRampCard } from "./_components/load-ramp";

type VariantEntry = {
  idiom: string;
  title: string;
  hero: string;
  defaultCandidate: boolean;
  note: string;
  Card: (props: { data: DxRunningFixture; unit: DistanceUnit }) => React.ReactNode;
};

// Ticket order. One entry per idiom; the hero assignment is binding.
const VARIANTS: VariantEntry[] = [
  {
    idiom: "stacked-week",
    title: "Running",
    hero: "total distance, decomposed",
    defaultCandidate: true,
    note: "The familiar weekly figure over a segmented per-run bar — alpha-stepped run sage, 4-week baseline as a ghost mark. Strava's weekly header with the decomposition it never does.",
    Card: StackedWeekCard,
  },
  {
    idiom: "week-log",
    title: "Runs This Week",
    hero: "the runs themselves",
    defaultCandidate: false,
    note: "No headline numeral at all — dated rows (day · distance · pace · HR) under a caption total. Sage lives only on the pace figure, brighter when a run beat baseline. Strava's feed row at Robinhood density.",
    Card: WeekLogCard,
  },
  {
    idiom: "pace-band",
    title: "Running Pace",
    hero: "pace vs your own normal",
    defaultCandidate: false,
    note: "A medium pace clock (this week, with the 30-day figure labelled separately) over a sage band: baseline centre line, one tick per run, faster left. Oura's normal-range band applied to pace.",
    Card: PaceBandCard,
  },
  {
    idiom: "effort-heart",
    title: "Run Effort",
    hero: "heart rate",
    defaultCandidate: false,
    note: "Duration-weighted weekly bpm over a zone rail — dots coloured by --zone-1..5, sized by duration, coverage always stated. The only variant spending the zone scale; no sage anywhere. Garmin's rail, Whoop's framing.",
    Card: EffortHeartCard,
  },
  {
    idiom: "vertical-gain",
    title: "Vertical Gain",
    hero: "climbing",
    defaultCandidate: false,
    note: "Weekly gain over a stepped per-run silhouette in run sage (hike clay forbidden). Treadmill runs are dashed-outline gaps, never zero columns. Strava's elevation profile as a per-run summary.",
    Card: VerticalGainCard,
  },
  {
    idiom: "load-ramp",
    title: "Training Load",
    hero: "the direction (time on feet)",
    defaultCandidate: true,
    note: "One big signed delta vs the 4-week baseline — status colour, never danger red — over a neutral 8-week micro-rail with a ghost baseline. The only headline still meaningful at zero runs. TrainingPeaks' ramp, Robinhood's delta.",
    Card: LoadRampCard,
  },
];

/** Static Walking neighbour for the pair mocks (spark points in display units). */
function walkingFixture(unit: DistanceUnit): Section<WalkingView> {
  const div = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  const fmt = (m: number) => (m / div).toFixed(1);
  const weeksMeters = [14484, 17703, 12070, 19312, 16093, 20921, 15288, 18507];
  return {
    present: true,
    currentWeek: { distance: fmt(18507), sessionCount: 6 },
    durationSeconds: 14520,
    latest: {
      name: "Evening walk",
      distance: fmt(4184),
      durationSeconds: 2940,
      startTime: "2026-08-01T23:10:00Z",
    },
    spark: { points: weeksMeters.map((m) => m / div), unit },
    unit,
  };
}

/** Static Steps neighbour for the pair mocks. */
const STEPS_FIXTURE: Section<StepsView> = {
  present: true,
  avg: 8214,
  today: 6423,
  goal: 9000,
  spark: [7812, 9134, 8577, 5420, 10841, 9267, 6423],
};

// Same responsive grid as the dashboard's CardGrid.
const CARD_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export default function RunningTileExplorePage() {
  if (!config.designExploreEnabled) notFound();
  return <Explorer />;
}

function Explorer() {
  const [unit, setUnit] = useState<DistanceUnit>("mi");

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
          Design exploration · throwaway · do not merge
        </p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          running-tile — six variants
        </h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Six compositions of the same near-black / run-sage / Manrope mini-card, each heroing a
          different figure. Scope is <span className="text-[var(--foreground)]">in-system</span>{" "}
          (design-system v0.4): variants diverge on layout, structure, density, and composition —
          never on palette, accent, or type. Ticket:{" "}
          <span className="font-mono text-xs">prog-strength-docs/dx/running-tile.md</span>
        </p>

        {/* Unit toggle — the DS segmented pill. Fixtures are metric; every
            variant formats through the shared unit helpers. */}
        <div className="flex items-center gap-3">
          <div className="flex w-fit items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["mi", "km"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className="rounded-full px-4 py-1 text-xs font-semibold transition"
                style={
                  unit === u
                    ? { backgroundColor: "var(--accent)", color: "var(--accent-fg)" }
                    : { color: "var(--muted)" }
                }
              >
                {u}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--faint)]">
            check every variant in both units — pace clocks and 4-digit foot counts have different
            widths
          </span>
        </div>
      </header>

      {/* One section per idiom, in ticket order, across all four states. */}
      {VARIANTS.map(({ idiom, title, hero, defaultCandidate, note, Card }) => (
        <section key={idiom} id={idiom} className="flex flex-col gap-4 scroll-mt-8">
          <header className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-0.5 font-mono text-xs text-[var(--foreground)]">
                {idiom}
              </span>
              <h2 className="text-base font-semibold text-[var(--foreground)]">“{title}”</h2>
              <span className="text-xs text-[var(--muted)]">heroes {hero}</span>
              {defaultCandidate && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  default candidate
                </span>
              )}
            </div>
            <p className="max-w-3xl text-xs text-[var(--muted)]">{note}</p>
          </header>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ALL_FIXTURES.map((fixture) => (
              <div key={fixture.key} className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
                  {fixture.label}
                </span>
                <Card data={fixture} unit={unit} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Pair-in-grid mocks: the whole premise of this DX is that the grid
          looks repetitive — so judge candidates IN a grid, beside the real
          Walking and Steps cards, not one at a time in isolation. */}
      <section id="pair-mocks" className="flex flex-col gap-8 scroll-mt-8">
        <header className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Pair-in-grid mocks</h2>
          <p className="max-w-3xl text-xs text-[var(--muted)]">
            A default candidate beside one enthusiast tile, in the dashboard&apos;s real grid, with
            Walking and Steps as neighbours. The test: does the pair read as two facts — and does
            the grid stop looking like the same green squiggle three times?
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
            mock 1 — stacked-week (default) + vertical-gain · walking · steps
          </span>
          <div className={CARD_GRID}>
            <StackedWeekCard data={ORDINARY_WEEK} unit={unit} />
            <VerticalGainCard data={ORDINARY_WEEK} unit={unit} />
            <WalkingCard section={walkingFixture(unit)} href="/activities" />
            <StepsCard section={STEPS_FIXTURE} href="/activities?view=steps" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
            mock 2 — load-ramp (default) + week-log · walking · steps
          </span>
          <div className={CARD_GRID}>
            <LoadRampCard data={ORDINARY_WEEK} unit={unit} />
            <WeekLogCard data={ORDINARY_WEEK} unit={unit} />
            <WalkingCard section={walkingFixture(unit)} href="/activities" />
            <StepsCard section={STEPS_FIXTURE} href="/activities?view=steps" />
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] pt-4 text-[11px] text-[var(--faint)]">
        Selection happens on the draft PR — pick a default (the generic running card is being
        retired), tick the enthusiast tiles worth keeping, close the PR. Never merge.
      </footer>
    </main>
  );
}

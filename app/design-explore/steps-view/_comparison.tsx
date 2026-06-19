"use client";

/**
 * Comparison harness for the steps-view DX. Renders all five idiom variants
 * on one screen, each labelled, and each shown at BOTH breakpoints at once:
 * a wide desktop frame and a ~360px phone frame. The breakpoint is driven by
 * container queries (each variant root is an `@container`), so the phone
 * frame genuinely shows the mobile treatment without resizing the window.
 *
 * A control bar drives every variant through the visual states the ticket
 * demands — the realistic month, the one-entry case, the empty case, the
 * goal / no-goal degrade, and the period filter (7 / 30 / 90 / All) — so the
 * reviewer can verify each variant survives them before picking.
 *
 * This file is throwaway scaffolding; the variants are the artifact.
 */

import { useState } from "react";
import {
  type DataState,
  type Period,
  type StepsEntry,
  type Goal,
  EMPTY,
  FIRST_ENTRY,
  FIXTURE_ENTRIES,
  GOAL,
  NO_GOAL,
  PERIODS,
} from "./_data";
import { EditorialAverage } from "./_variants/editorial-average";
import { GoalRingHero } from "./_variants/goal-ring-hero";
import { StreakMomentum } from "./_variants/streak-momentum";
import { SparklineLedger } from "./_variants/sparkline-ledger";
import { CalendarHeat } from "./_variants/calendar-heat";

type VariantFn = (props: { entries: StepsEntry[]; goal: Goal; period: Period }) => React.ReactNode;

const VARIANTS: {
  id: string;
  name: string;
  drawsOn: string;
  distinct: string;
  Component: VariantFn;
}[] = [
  {
    id: "editorial-average",
    name: "editorial-average",
    drawsOn: "The Athletic's authored headline-figure layout",
    distinct:
      "Dramatic big/small type — the average is a 88px headline · accent reserved for the hero number + its baseline · airy editorial rhythm",
    Component: EditorialAverage,
  },
  {
    id: "goal-ring-hero",
    name: "goal-ring-hero",
    drawsOn: "Apple Fitness's activity ring + Gentler Streak's goal-relative day treatment",
    distinct:
      "The ring's center number anchors the scale · accent fills the ring, success crests the goal-relative bars · centered, generous around the ring",
    Component: GoalRingHero,
  },
  {
    id: "streak-momentum",
    name: "streak-momentum",
    drawsOn: "Whoop's consistency readout + Gentler Streak's gentle Voice",
    distinct:
      "Compact type — hierarchy from the ribbon + streak count · success=hit, accent rides the current streak · tight, momentum-forward",
    Component: StreakMomentum,
  },
  {
    id: "sparkline-ledger",
    name: "sparkline-ledger",
    drawsOn: "Robinhood's sparkline rows + Linear's earned table density",
    distinct:
      "Small functional tabular figures · accent/success spent only on the delta sign + inline spark · dense blotter, week-grouped",
    Component: SparklineLedger,
  },
  {
    id: "calendar-heat",
    name: "calendar-heat",
    drawsOn: "GitHub's contribution graph + Cardiogram's day calendar",
    distinct:
      "Uniform grid labels, one calm header figure · single-hue attainment ramp, accent ring marks a hit · even, calendar-regular grid",
    Component: CalendarHeat,
  },
];

export function Comparison() {
  const [dataState, setDataState] = useState<DataState>("month");
  const [hasGoal, setHasGoal] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");

  const entries: StepsEntry[] =
    dataState === "month" ? FIXTURE_ENTRIES : dataState === "first" ? FIRST_ENTRY : EMPTY;
  const goal: Goal = hasGoal ? GOAL : NO_GOAL;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1180px] px-5 py-8 @container/page">
        {/* ── Page header ─────────────────────────────────────── */}
        <header className="mb-6 border-b border-[var(--border)] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--accent)]">
              DX · DO NOT MERGE
            </span>
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 font-mono text-[11px] text-[var(--muted)]">
              scope: in-system
            </span>
          </div>
          <h1 className="mt-3 text-[24px] font-bold tracking-[-0.02em]">steps-view</h1>
          <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-[var(--muted)]">
            Five genuinely different compositions of the Steps tab of{" "}
            <code className="text-[var(--foreground)]">/activities</code> — same dark near-black /
            periwinkle / Manrope system, diverging on which element is the hero (the average, the
            goal ring, the streak, the log, the calendar) and on type scale, color logic, and
            spacing rhythm. Each is shown at both breakpoints (desktop frame + phone frame).
            Throwaway exploration; the winner is reimplemented by a downstream SOW.
          </p>
        </header>

        {/* ── Controls ────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 -mx-5 mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-5 py-3 backdrop-blur">
          <Segmented
            label="Data"
            value={dataState}
            onChange={(v) => setDataState(v as DataState)}
            options={[
              { value: "month", label: "Realistic" },
              { value: "first", label: "First entry" },
              { value: "empty", label: "Empty" },
            ]}
          />
          <Segmented
            label="Goal"
            value={hasGoal ? "set" : "none"}
            onChange={(v) => setHasGoal(v === "set")}
            options={[
              { value: "set", label: "Goal set" },
              { value: "none", label: "No goal" },
            ]}
          />
          <Segmented
            label="Period"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.id, label: p.id === "all" ? "All" : p.id }))}
          />
          <nav className="ml-auto hidden items-center gap-1 font-mono text-[11px] text-[var(--muted)] @3xl/page:flex">
            {VARIANTS.map((v) => (
              <a key={v.id} href={`#${v.id}`} className="rounded px-2 py-1 hover:bg-white/5">
                {v.name}
              </a>
            ))}
          </nav>
        </div>

        {/* ── Variant sections ────────────────────────────────── */}
        <div className="flex flex-col gap-14">
          {VARIANTS.map((v, i) => (
            <section key={v.id} id={v.id} className="scroll-mt-24">
              <div className="mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[12px] text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-mono text-[16px] font-semibold text-[var(--foreground)]">
                    {v.name}
                  </h2>
                </div>
                <p className="mt-1 pl-8 text-[12px] text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Draws on</span> {v.drawsOn}
                </p>
                <p className="pl-8 text-[12px] text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Distinct</span> {v.distinct}
                </p>
              </div>

              <div className="flex flex-col gap-6 @4xl/page:flex-row @4xl/page:items-start">
                {/* Desktop frame — wide enough to trip the @md container query */}
                <div className="min-w-0 flex-1">
                  <FrameLabel>desktop</FrameLabel>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
                    <v.Component entries={entries} goal={goal} period={period} />
                  </div>
                </div>

                {/* Phone frame — narrow, container query falls back to mobile */}
                <div className="shrink-0">
                  <FrameLabel>mobile · 360px</FrameLabel>
                  <div className="w-[360px] max-w-full rounded-[26px] border-2 border-[var(--border-strong)] bg-[var(--background)] p-3 shadow-[var(--shadow-soft)]">
                    <div className="rounded-[16px] bg-[var(--background)] px-3 py-4">
                      <v.Component entries={entries} goal={goal} period={period} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--faint)]">
          Disposable exploration · gated by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE · never merged ·
          dx/steps-view
        </footer>
      </div>
    </div>
  );
}

function FrameLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
      {children}
    </span>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">
        {label}
      </span>
      <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium uppercase transition ${
                active
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

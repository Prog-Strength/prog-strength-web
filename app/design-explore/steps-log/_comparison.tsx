/**
 * DX steps-log — the side-by-side comparison harness.
 *
 * Renders all five idiom variants of the Steps-tab LOG REGION on one screen,
 * each in a phone-width column (the log is a narrow surface; this also stands in
 * for the mobile breakpoint) labelled with its idiom name + a one-line rationale
 * and an anchor id the PR body links to. A single Goal on/off toggle drives every
 * variant at once so the reviewer can check the no-goal degradation across the
 * whole spread. A faint goal-ring stub sits above the columns as a reminder that
 * the winner must feel native beneath the shipped hero.
 *
 * This is a disposable comparison surface — divergence between variants is the
 * point; there is no shared visual abstraction here beyond design-system atoms.
 */
"use client";

import { useState } from "react";
import { GOAL } from "./_data";
import { WeekAccordion } from "./_variants/week-accordion";
import { MonthChapter } from "./_variants/month-chapter";
import { TimelineRail } from "./_variants/timeline-rail";
import { SummaryBandRows } from "./_variants/summary-band-rows";
import { WeekCardPages } from "./_variants/week-card-pages";

type VariantDef = {
  id: string;
  name: string;
  blurb: string;
  render: (goal: number | null) => React.ReactNode;
};

// Ticket order — the spread the reviewer compares.
const VARIANTS: VariantDef[] = [
  {
    id: "week-accordion",
    name: "week-accordion",
    blurb: "Collapsible weeks — summaries first, day detail on demand. Current week open.",
    render: (g) => <WeekAccordion goal={g} />,
  },
  {
    id: "month-chapter",
    name: "month-chapter",
    blurb: "Month rollup is the hero; weeks nest as caption lines. One chapter per page.",
    render: (g) => <MonthChapter goal={g} />,
  },
  {
    id: "timeline-rail",
    name: "timeline-rail",
    blurb: "Weeks as nodes on a spine; connectors encode week-over-week delta.",
    render: (g) => <TimelineRail goal={g} />,
  },
  {
    id: "summary-band-rows",
    name: "summary-band-rows",
    blurb: "Flat day rows with interstitial week/month bands. Nothing hidden.",
    render: (g) => <SummaryBandRows goal={g} />,
  },
  {
    id: "week-card-pages",
    name: "week-card-pages",
    blurb: "Each week is a self-contained card; a handful per page, Prev/Next + dots.",
    render: (g) => <WeekCardPages goal={g} />,
  },
];

export function StepsLogComparison() {
  const [hasGoal, setHasGoal] = useState(true);
  const goal = hasGoal ? GOAL : null;

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
              DX · do not merge
            </span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
              in-system
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">steps-log — 5 design variants</h1>
          <p className="max-w-3xl text-sm text-[var(--muted)]">
            Five genuinely different compositions of the same near-black / periwinkle / Manrope
            surface, all exploring only the{" "}
            <strong className="font-semibold text-[var(--foreground)]">log region</strong> of the
            Steps tab — how logged days group into weeks and months, how each week&rsquo;s summary
            reads, and how pagination caps the list. Same fixture (goal 10,000, a June→July history)
            drives every column. Palette, accent, and type are fixed by the design system; the
            variants diverge on <em>layout, structure, density, and composition</em>.
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setHasGoal((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
            >
              <span
                className="grid h-4 w-7 items-center rounded-full px-0.5 transition-colors"
                style={{ background: hasGoal ? "var(--accent)" : "var(--surface-3)" }}
              >
                <span
                  className="h-3 w-3 rounded-full bg-white transition-transform"
                  style={{ transform: hasGoal ? "translateX(12px)" : "translateX(0)" }}
                />
              </span>
              Goal: {hasGoal ? "10,000" : "not set"}
            </button>
            <span className="text-[11px] text-[var(--muted)]">
              Toggle to preview the no-goal state across every variant (no NaN%, day rows still
              usable).
            </span>
          </div>
        </header>

        {/* Faint reminder of the shipped hero the log sits beneath. */}
        <div className="mt-6 flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-4 py-3 text-[var(--faint)]">
          <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-[var(--surface-3)]">
            <span className="h-4 w-4 rounded-full border-[3px] border-[var(--accent)]/50" />
          </span>
          <span className="text-xs">
            ↑ shipped goal-ring hero + daily-steps chart live here — every variant below is only the
            log region that follows.
          </span>
        </div>

        <div className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4 [scrollbar-width:thin]">
          {VARIANTS.map((v, i) => (
            <section
              key={v.id}
              id={v.id}
              className="flex w-[400px] shrink-0 snap-start scroll-mt-6 flex-col gap-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                  {i + 1}
                </span>
                <h2 className="font-mono text-[13px] font-semibold text-[var(--accent)]">
                  {v.name}
                </h2>
              </div>
              <p className="min-h-[32px] text-[11px] leading-snug text-[var(--muted)]">{v.blurb}</p>
              <div className="rounded-[var(--radius-card-lg)] border border-[var(--border)] bg-[var(--background)] p-4 shadow-xl shadow-black/20">
                {v.render(goal)}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          Disposable exploration on a throwaway branch — never merged. The chosen direction is
          reimplemented production-quality by a downstream SOW.
        </footer>
      </div>
    </div>
  );
}

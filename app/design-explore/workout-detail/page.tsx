"use client";

/**
 * DX comparison route — workout-detail · DO NOT MERGE.
 *
 * Renders all five idiom variants of the Workout Detail page on a single screen
 * so a human can compare directions and pick one. This route is THROWAWAY and
 * flag-gated: it 404s unless config.designExploreEnabled (backed by the single
 * shared env var NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE — see lib/config.ts), so it
 * is dead in production and unreachable from product navigation. It lives
 * OUTSIDE the (app) route group — no auth, no sidebar, no live data — and feeds
 * entirely off static fixtures (_fixtures.ts).
 *
 * Each variant is a self-contained component under _variants/. Duplication
 * between them is intentional: the value of a DX is the SPREAD, not shared
 * abstraction. The fixture toggle (canonical 4-PR day vs the zero-PR / no-note /
 * no-ended_at degrade session) exercises each variant across the range the
 * ticket calls out.
 *
 * scope: in-system — every variant uses the v0.4 oura-calm tokens (near-black
 * ramp, periwinkle accent as app-chrome only, lift steel-blue discipline tone,
 * --warning for the PR celebration, --success for deltas, Manrope). The spread
 * is in layout / structure / density / composition, NOT palette, accent, or
 * type.
 *
 * Ticket: prog-strength-docs/dx/workout-detail.md
 */

import { useState, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { FIXTURES, type FixtureKey } from "./_fixtures";
import { SessionRecap } from "./_variants/SessionRecap";
import { PrCelebration } from "./_variants/PrCelebration";
import { ExerciseLedger } from "./_variants/ExerciseLedger";
import { TrainingDashboard } from "./_variants/TrainingDashboard";
import { SessionTimeline } from "./_variants/SessionTimeline";
import type { WorkoutFixture } from "./_fixtures";

// Order matches the ticket's `idioms:` list exactly.
const VARIANTS: {
  id: string;
  n: number;
  title: string;
  draws: string;
  distinct: string;
  Component: (props: { fixture: WorkoutFixture }) => ReactElement;
}[] = [
  {
    id: "session-recap",
    n: 1,
    title: "Session Recap",
    draws: "The Athletic recap / Oura day card",
    distinct:
      "Widest type contrast — one editorial headline + prose reflection; warning only on the PR subhead; airy reading column.",
    Component: SessionRecap,
  },
  {
    id: "pr-celebration",
    n: 2,
    title: "PR Celebration",
    draws: "Apple Fitness award moment / Strava achievements",
    distinct:
      "PRs are the page — hero cards with a large weight + delta (245→305 +60), each tied to its set in the ramp; warning + success carry meaning.",
    Component: PrCelebration,
  },
  {
    id: "exercise-ledger",
    n: 3,
    title: "Exercise Ledger",
    draws: "Strong / Hevy workout log",
    distinct:
      "Densest — uniform tabular set rows; warm-ups dimmed, working/top set steel-blue, PR row in warning; hierarchy from alignment.",
    Component: ExerciseLedger,
  },
  {
    id: "training-dashboard",
    n: 4,
    title: "Training Dashboard",
    draws: "Whoop overview grid",
    distinct:
      "One consolidated sets-by-muscle chart (radar killed) beside KPI tiles; exercise list demotes to a dense table; status-encoded color.",
    Component: TrainingDashboard,
  },
  {
    id: "session-timeline",
    n: 5,
    title: "Session Timeline",
    draws: "Strava activity timeline / laps",
    distinct:
      "Vertical time spine off the 1h 20m duration; PR breaks glow as warm beats; the note drops inline late where it belongs.",
    Component: SessionTimeline,
  },
];

export default function DesignExploreWorkoutDetailPage() {
  // Flag gate — render nothing (404) unless explicitly enabled.
  if (!config.designExploreEnabled) {
    notFound();
  }

  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("canonical");
  const fixture = FIXTURES.find((f) => f.key === fixtureKey)!;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">
                  DX · do not merge
                </span>
                <h1 className="text-base font-semibold tracking-tight">
                  Workout Detail — 5 variants
                </h1>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Five compositions of the same v0.4 oura-calm surface (near-black · periwinkle ·
                Manrope · lift steel-blue). Compare, then pick one. Each variant is throwaway.
              </p>
            </div>
            <nav className="flex flex-wrap gap-1.5 text-xs">
              {VARIANTS.map((v) => (
                <a
                  key={v.id}
                  href={`#${v.id}`}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  {v.n}. {v.title}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              Fixture
            </span>
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
              {FIXTURES.map((f) => {
                const active = f.key === fixtureKey;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFixtureKey(f.key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-[var(--surface-2)] text-[var(--foreground)] ring-1 ring-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10">
        {VARIANTS.map((v) => (
          <section key={v.id} id={v.id} className="scroll-mt-36">
            <div className="mb-4 flex flex-col gap-1 border-l-2 border-[var(--accent-line)] pl-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold tabular-nums text-[var(--accent)]">
                  {String(v.n).padStart(2, "0")}
                </span>
                <h2 className="text-sm font-semibold tracking-tight">{v.title}</h2>
                <code className="text-[11px] text-[var(--faint)]">{v.id}</code>
              </div>
              <p className="text-xs text-[var(--muted)]">
                <span className="text-[var(--foreground)]">Draws on</span> {v.draws} · {v.distinct}
              </p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
              <v.Component fixture={fixture} />
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          Disposable exploration · branch <code>dx/workout-detail</code> · never merged. The chosen
          variant is reimplemented production-quality by a downstream SOW.
        </footer>
      </div>
    </main>
  );
}

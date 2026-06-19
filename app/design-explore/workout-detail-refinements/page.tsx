"use client";

/**
 * DX comparison route — workout-detail-refinements · DO NOT MERGE.
 *
 * Renders all five GRAPHIC idioms for the Workout Detail page on one screen so a
 * human can compare directions and pick one. This DX refines the already-shipped
 * session-recap page; it does NOT re-explore it wholesale. Every variant carries
 * the SAME recap structure and the SAME new expand-to-sets affordance (both in
 * _shared.tsx) — the one thing that differs is the graphic that replaces the
 * "What it trained" text strip. That is the whole comparison.
 *
 * THROWAWAY and flag-gated: it 404s unless config.designExploreEnabled (backed
 * by the single shared env var NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE — see
 * lib/config.ts), so it is dead in production and unreachable from product nav.
 * It lives OUTSIDE the (app) route group — no auth, no sidebar, no live data —
 * and feeds entirely off static fixtures (_fixtures.ts).
 *
 * Each variant is a self-contained component under _variants/. The fixture
 * toggle exercises each graphic across the range the ticket calls out: the
 * sparse leg day (the crux that killed the radar), the full push/pull day, and
 * the uncategorizable mobility session (the degrade).
 *
 * scope: in-system — every variant uses the v0.4 oura-calm tokens (near-black
 * ramp, periwinkle accent as app-chrome only, the lift steel-blue discipline
 * hue for the graphic, --warning only on the PR, Manrope). The spread is in
 * layout / structure / density / composition of the GRAPHIC, NOT palette,
 * accent, or type.
 *
 * Ticket: prog-strength-docs/dx/workout-detail-refinements.md
 */

import { useState, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { FIXTURES, type FixtureKey, type WorkoutFixture } from "./_fixtures";
import { MuscleBodyMap } from "./_variants/muscle-body-map";
import { PerExerciseVolumeBars } from "./_variants/per-exercise-volume-bars";
import { BodyPartsRadar } from "./_variants/body-parts-radar";
import { PerMuscleSetBars } from "./_variants/per-muscle-set-bars";
import { QuietInlineStrip } from "./_variants/quiet-inline-strip";

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
    id: "muscle-body-map",
    n: 1,
    title: "Muscle body-map",
    draws: "Strava's anatomical muscle heatmap",
    distinct:
      "Minimal type, an intensity ramp over a front/back silhouette, generous hero placement beside the stat line — the sparse leg day glows rather than breaks.",
    Component: MuscleBodyMap,
  },
  {
    id: "per-exercise-volume-bars",
    n: 2,
    title: "Per-exercise volume bars",
    draws: "Hevy / Strong session breakdowns",
    distinct:
      "The volume number leads; uniform steel-blue bars (PR marked in --warning); densest, tightest row rhythm — zero degeneracy, every lift has a bar.",
    Component: PerExerciseVolumeBars,
  },
  {
    id: "body-parts-radar",
    n: 3,
    title: "Body-parts radar",
    draws: "Whoop's single promoted emphasis shape",
    distinct:
      "Axis labels carry the counts; translucent steel-blue area over an always-drawn six-axis frame; centered, airy — the flashiest shape, the most risk on sparse data.",
    Component: BodyPartsRadar,
  },
  {
    id: "per-muscle-set-bars",
    n: 4,
    title: "Per-muscle set bars",
    draws: "TrainingPeaks' per-segment bars",
    distinct:
      "Balanced label/count pairs; uniform steel-blue fill; calm medium rhythm — the smallest leap from today's strip, degrades by showing fewer bars.",
    Component: PerMuscleSetBars,
  },
  {
    id: "quiet-inline-strip",
    n: 5,
    title: "Quiet inline strip",
    draws: "The shipped session-recap's own restraint",
    distinct:
      "Smallest type (caption only); one steel-blue hue graded by share in a single thin segmented bar; inline in the column — barely raises the page's volume.",
    Component: QuietInlineStrip,
  },
];

export default function DesignExploreWorkoutDetailRefinementsPage() {
  // Flag gate — render nothing (404) unless explicitly enabled.
  if (!config.designExploreEnabled) {
    notFound();
  }

  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("leg-day");
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
                  Workout Detail — refinements · 5 graphic variants
                </h1>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Same v0.4 recap page, same new expand-to-sets — five different graphics for the
                session. Which one replaces the &ldquo;What it trained&rdquo; strip? Compare, then
                pick one. Each variant is throwaway.
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
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-[11px] text-[var(--faint)]">{fixture.blurb}</span>
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
          Disposable exploration · branch <code>dx/workout-detail-refinements</code> · never merged.
          The chosen graphic is reimplemented production-quality by a downstream SOW.
        </footer>
      </div>
    </main>
  );
}

"use client";

/**
 * DX comparison route — personal-records-lifts · DO NOT MERGE.
 *
 * Renders all five idiom variants of the Personal Records "Lifts" view on a
 * single screen so a human can compare directions and pick one. This route
 * is THROWAWAY and flag-gated: it 404s unless NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE
 * === "true" (see lib/config.ts), so it is dead in production and unreachable
 * from product navigation. It deliberately lives OUTSIDE the (app) route group
 * — no auth, no sidebar, no live data — and feeds entirely off static fixtures.
 *
 * Each variant is a self-contained component under _variants/. Duplication
 * between them is intentional: the value of a DX is the SPREAD, not shared
 * abstraction. The dataset (3 / 8 / 12 lifts) and render-mode (data / loading /
 * error) toggles let each variant be exercised across the full range the
 * ticket calls out.
 *
 * Ticket: prog-strength-docs/dx/personal-records-lifts.md
 */

import { useState } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { DATASETS, type Dataset, type RenderMode } from "./_fixtures";
import { ReadinessGauge } from "./_variants/ReadinessGauge";
import { LeaderboardRows } from "./_variants/LeaderboardRows";
import { EditorialCards } from "./_variants/EditorialCards";
import { CompactDashboard } from "./_variants/CompactDashboard";
import { MomentumTimeline } from "./_variants/MomentumTimeline";

// Order matches the ticket's `idioms:` list exactly.
const VARIANTS = [
  {
    id: "readiness-gauge",
    n: 1,
    title: "Readiness Gauge",
    draws: "Whoop / Oura readiness bars",
    distinct: "The PR→estimate gap as a lit track; warning spent only on the lit segment.",
    Component: ReadinessGauge,
  },
  {
    id: "leaderboard-rows",
    n: 2,
    title: "Leaderboard Rows",
    draws: "Linear row density / Strava segment leaderboards",
    distinct: "Ranked dense rows by gap%; tabular alignment; empty lifts sink to a quiet group.",
    Component: LeaderboardRows,
  },
  {
    id: "editorial-cards",
    n: 3,
    title: "Editorial Cards",
    draws: "Apple Fitness summary cards",
    distinct: "Big type-scale contrast, one hero per card, label furniture demoted to a stat line.",
    Component: EditorialCards,
  },
  {
    id: "compact-dashboard",
    n: 4,
    title: "Compact Dashboard",
    draws: "Whoop overview grid / trading dashboard",
    distinct:
      "High-density tiles, small functional type, readiness encoded as a scaling dot + spark.",
    Component: CompactDashboard,
  },
  {
    id: "momentum-timeline",
    n: 5,
    title: "Momentum Timeline",
    draws: "Gentler Streak 'due' framing / Strava trend surfaces",
    distinct:
      "Ordered by due-ness; time-since-PR prominent; the progression spark promoted inline.",
    Component: MomentumTimeline,
  },
] as const;

const MODES: { key: RenderMode; label: string }[] = [
  { key: "data", label: "Data" },
  { key: "loading", label: "Loading" },
  { key: "error", label: "Error" },
];

export default function DesignExplorePersonalRecordsLiftsPage() {
  // Flag gate — render nothing (404) unless explicitly enabled.
  if (!config.enableDesignExplore) {
    notFound();
  }

  const [dataset, setDataset] = useState<Dataset>("canonical");
  const [mode, setMode] = useState<RenderMode>("data");
  const records = DATASETS.find((d) => d.key === dataset)!.records;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* DX banner + controls */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">
                  DX · do not merge
                </span>
                <h1 className="text-base font-semibold tracking-tight">
                  Personal Records — Lifts · 5 variants
                </h1>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Five compositions of the same near-black / periwinkle / Manrope surface. Compare,
                then pick one. Each variant is throwaway.
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
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              label="Dataset"
              options={DATASETS.map((d) => ({ key: d.key, label: d.label }))}
              value={dataset}
              onChange={(k) => setDataset(k as Dataset)}
            />
            <Toggle
              label="State"
              options={MODES}
              value={mode}
              onChange={(k) => setMode(k as RenderMode)}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-10">
        {VARIANTS.map((v) => (
          <section key={v.id} id={v.id} className="scroll-mt-32">
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
            {/* Each variant renders the whole Lifts view: page chrome + the body. */}
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)]">
              <v.Component records={records} mode={mode} />
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          Disposable exploration · branch <code>dx/personal-records-lifts</code> · never merged. The
          chosen variant is reimplemented production-quality by a downstream SOW.
        </footer>
      </div>
    </main>
  );
}

function Toggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </span>
      <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "bg-[var(--surface-2)] text-[var(--foreground)] ring-1 ring-[var(--accent)]"
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

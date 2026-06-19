"use client";

/**
 * Comparison harness for the bodyweight-readings-table DX. Renders all
 * five idiom variants on one screen, each labelled, and each shown at
 * BOTH breakpoints at once: a wide desktop frame and a ~360px phone
 * frame. The breakpoint is driven by container queries (each variant is
 * an `@container`), so the phone frame genuinely shows the mobile
 * treatment without the viewer resizing the window.
 *
 * A control bar drives every variant through the visual states the ticket
 * demands — the realistic multi-per-day month, the single-first-reading
 * case, the empty case, and the goal / no-goal toolbar split — so the
 * reviewer can verify each variant handles them before picking.
 *
 * This file is throwaway scaffolding; the variants are the artifact.
 */

import { useState } from "react";
import {
  FIXTURE_READINGS,
  FIRST_READING,
  FIXTURE_GOAL,
  NO_GOAL,
  type Goal,
  type Reading,
} from "./_data";
import { LedgerDense } from "./_variants/ledger-dense";
import { DayCardFeed } from "./_variants/day-card-feed";
import { TimelineRail } from "./_variants/timeline-rail";
import { SparklineRows } from "./_variants/sparkline-rows";
import { StatLedger } from "./_variants/stat-ledger";

type VariantFn = (props: { readings: Reading[]; goal: Goal }) => React.ReactNode;

const VARIANTS: {
  id: string;
  name: string;
  drawsOn: string;
  distinct: string;
  Component: VariantFn;
}[] = [
  {
    id: "ledger-dense",
    name: "ledger-dense",
    drawsOn: "Linear's earned table density + a trading blotter",
    distinct: "Smallest mono type · structural accent only on the down-Δ caret · densest rhythm",
    Component: LedgerDense,
  },
  {
    id: "day-card-feed",
    name: "day-card-feed",
    drawsOn: "Things' soft day-sections + Cardiogram's same-day grouping",
    distinct: "Largest hero numeral (day avg) · accent only on the delta chip · airiest spacing",
    Component: DayCardFeed,
  },
  {
    id: "timeline-rail",
    name: "timeline-rail",
    drawsOn: "GitHub's activity timeline + Oura's day spine",
    distinct: "Medium type · the rail is the structure, accent marks down-moves · generous rhythm",
    Component: TimelineRail,
  },
  {
    id: "sparkline-rows",
    name: "sparkline-rows",
    drawsOn: "Robinhood / Whoop list rows",
    distinct: "Mid type · accent spent entirely on an inline 7-day spark · mid-dense rows",
    Component: SparklineRows,
  },
  {
    id: "stat-ledger",
    name: "stat-ledger",
    drawsOn: "TrendWeight's summary table + Copilot Money's account header",
    distinct: "Sharpest type-scale contrast · accent on the summary band, rows neutral",
    Component: StatLedger,
  },
];

type DataState = "month" | "first" | "empty";

export function Comparison() {
  const [dataState, setDataState] = useState<DataState>("month");
  const [hasGoal, setHasGoal] = useState(true);

  const readings: Reading[] =
    dataState === "month" ? FIXTURE_READINGS : dataState === "first" ? FIRST_READING : [];
  const goal: Goal = hasGoal ? FIXTURE_GOAL : NO_GOAL;

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
          <h1 className="mt-3 text-[24px] font-bold tracking-[-0.02em]">
            bodyweight-readings-table
          </h1>
          <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--muted)]">
            Five genuinely different compositions of the{" "}
            <code className="text-[var(--foreground)]">/bodyweight</code> log region — same dark
            near-black / periwinkle / Manrope system, diverging on layout, density, and which
            element is the hero. Each is shown at both breakpoints (desktop frame + phone frame).
            Throwaway exploration; the winner is reimplemented by a downstream SOW.
          </p>
        </header>

        {/* ── Controls ────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 -mx-5 mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-5 py-3 backdrop-blur">
          <Segmented
            label="Data"
            value={dataState}
            onChange={(v) => setDataState(v as DataState)}
            options={[
              { value: "month", label: "Realistic month" },
              { value: "first", label: "First reading" },
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
            <section key={v.id} id={v.id} className="scroll-mt-20">
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
                {/* Desktop frame — wide enough to trip the @lg container query */}
                <div className="min-w-0 flex-1">
                  <FrameLabel>desktop</FrameLabel>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]">
                    <v.Component readings={readings} goal={goal} />
                  </div>
                </div>

                {/* Phone frame — narrow, container query falls back to mobile */}
                <div className="shrink-0">
                  <FrameLabel>mobile · 360px</FrameLabel>
                  <div className="w-[360px] max-w-full rounded-[26px] border-2 border-[var(--border-strong)] bg-[var(--background)] p-3 shadow-[var(--shadow-soft)]">
                    <div className="rounded-[16px] bg-[var(--background)] px-3 py-4">
                      <v.Component readings={readings} goal={goal} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--faint)]">
          Disposable exploration · gated by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE · never merged ·
          dx/bodyweight-readings-table
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
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
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

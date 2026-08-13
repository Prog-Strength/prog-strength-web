/**
 * The `recovery-page-refresh` comparison surface — THROWAWAY.
 *
 * Four full-page compositions of the same near-black / periwinkle / Manrope
 * recovery surface, stacked on one screen and driven across the same four
 * fixtures, so the pick is made on one history rather than four flattering ones.
 *
 * What is HELD CONSTANT across the spread, and therefore is not what to compare:
 * the palette, the accent, the type family (scope: `in-system`), and the HRV
 * panel itself (Fixed Decision 2 — the shipped tile's ribbon, rolling curve,
 * out-of-band marks and gauge, rendered here at page scale by one shared
 * component). The HRV chart will look good in all four because it IS all four.
 *
 * What is being compared: how history is NAVIGATED, how the three metrics
 * relate SPATIALLY, and what FORM the score and resting-HR charts take — plus
 * the one real cost difference, which is that `season-rail` alone commits the
 * P2 API work.
 *
 * Nothing here is production code and none of it is promoted: the winning
 * direction is rebuilt by a downstream SOW.
 */

"use client";

import { useState, type ReactNode } from "react";
import type { RecoveryView } from "@/lib/dashboard";
import { FIXTURES, type FixtureKey } from "./_fixtures";
import { AlignedDeckVariant } from "./_variants/aligned-deck";
import { MetricFocusVariant } from "./_variants/metric-focus";
import { LedgerFirstVariant } from "./_variants/ledger-first";
import { SeasonRailVariant } from "./_variants/season-rail";

type Variant = {
  idiom: string;
  line: string;
  draws: string;
  distinct: string;
  score: string;
  rhr: string;
  p2: string;
  render: (props: { view: RecoveryView }) => ReactNode;
};

const VARIANTS: Variant[] = [
  {
    idiom: "aligned-deck",
    line: "three charts, one time axis",
    draws:
      "Apple Health's stacked metric detail and a trading terminal's synchronized crosshair — drag anywhere and all three panels read out the same morning.",
    distinct:
      "Uniform small type (nothing above 24px) · colour confined to the score columns and the warm side of the RHR zero line · one continuous hairline-divided instrument with no gaps between panels.",
    score:
      "Banded column chart — one column per morning in its canonical Whoop band, zone hairlines at 33 and 67.",
    rhr: "Diverging bars around the trailing average, which is the one figure the payload actually carries.",
    p2: "not required",
    render: ({ view }) => <AlignedDeckVariant view={view} />,
  },
  {
    idiom: "metric-focus",
    line: "one metric at a time, in full",
    draws:
      "Apple Health's single-metric detail and Oura's trends switcher — one thing at a time, made to feel complete rather than partial.",
    distinct:
      "The widest type range in the spread (48px window figure down to 10px labels) · colour spent almost entirely inside the focused panel · editorial, airy spacing in a single reading column.",
    score:
      "Banded area with an on-plot band legend and the window's day-count distribution printed as text beside it.",
    rhr: "The shipped rank strip promoted to page scale, with a dated line chart beneath it — rank answers “is this good for me?”, the line answers “what has it been doing?”.",
    p2: "not required — deliberately: this variant's thesis is that resting HR never needed a band",
    render: ({ view }) => <MetricFocusVariant view={view} />,
  },
  {
    idiom: "ledger-first",
    line: "the record is the page",
    draws:
      "Garmin Connect's metric-history tables and Linear's two-pane density — the record permanently visible, the charts serving it.",
    distinct:
      "Dead-flat dense type (12px tabular everywhere, no hero number at all) · band tint lives inside the ledger's score cells and essentially nowhere else · 30px rows on a strict uniform rhythm.",
    score:
      "The ledger cell IS the chart — each row's score cell filled to its value and tinted by its band, so scanning the column is reading a bar chart of the month.",
    rhr: "A column of micro-sparklines, one per row, each showing that morning against the trailing seven; the same diverging bars as aligned-deck in the detail panel.",
    p2: "not required",
    render: ({ view }) => <LedgerFirstVariant view={view} />,
  },
  {
    idiom: "season-rail",
    line: "scrub the whole history",
    draws:
      "Whoop's trend calendar and the GitHub contribution graph — every stored morning as a band-coloured cell, navigation and colour in one object.",
    distinct:
      "Tiny 8–9px rail labels against one 32px window figure and nothing in between · essentially all of the page's colour is in the rail · one dominant horizontal band over calm full-width panels.",
    score:
      "There isn't one, deliberately — the rail is the score chart, and a second banded chart would say it twice.",
    rhr: "A banded ribbon matching HRV's form, drawn against a resting-HR baseline and per-day band that DO NOT EXIST YET — the variant's argument, and its bill.",
    p2: "REQUIRED — selecting this variant funds resting-HR spread and per-day banding in `recoverytrend`",
    render: ({ view }) => <SeasonRailVariant view={view} />,
  },
];

export function Comparison() {
  const [key, setKey] = useState<FixtureKey>("default");
  const fixture = FIXTURES.find((f) => f.key === key) ?? FIXTURES[0];

  return (
    <main className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-6 py-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Design Exploration · do not merge
          </p>
          <h1 className="text-3xl tracking-[-0.03em]">recovery-page-refresh</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            Four compositions of the same recovery surface, for a page whose job has changed. Five
            recovery tiles now answer{" "}
            <em className="not-italic text-[var(--foreground)]">how am I this morning?</em> on the
            dashboard, so this page owns what a tile cannot hold — long windows, per-metric detail,
            the full ledger, patterns across weeks. Every variant honours the same fixed decisions
            and none re-decides the palette, the accent, the type, or the HRV chart.
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-[var(--faint)]">
            The HRV panel is the one element deliberately{" "}
            <strong className="font-normal text-[var(--muted)]">held constant</strong> — it is the
            same component in all four, so it will look good in all four. Compare the{" "}
            <strong className="font-normal text-[var(--muted)]">score and resting-HR charts</strong>
            , how each variant gets you to March, and whether the bad morning at the end of the
            fixture reads calmly. Two variants say resting HR never needed a band; one says all
            three metrics should be drawn alike and asks for the API work to get there.
          </p>
        </div>
      </header>

      {/* Fixture driver — every variant is judged on the same morning. */}
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              Fixture
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1">
              {FIXTURES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setKey(f.key)}
                  className={`rounded-[var(--radius-pill)] px-3 py-1 text-xs transition ${
                    f.key === key
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <nav className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              {VARIANTS.map((v, i) => (
                <a key={v.idiom} href={`#${v.idiom}`} className="hover:text-[var(--accent)]">
                  <span className="text-[var(--faint)]">{i + 1}.</span> {v.idiom}
                </a>
              ))}
            </nav>
          </div>
          <p className="mt-2 max-w-4xl text-xs leading-relaxed text-[var(--muted)]">
            {fixture.note}
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        {VARIANTS.map((v, i) => (
          <section
            key={v.idiom}
            id={v.idiom}
            className="scroll-mt-24 border-b border-[var(--border)]"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface)]/40 px-6 py-4">
              <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-1.5">
                <h2 className="text-lg tracking-[-0.02em] text-[var(--foreground)]">
                  <span className="text-[var(--faint)]">{i + 1}. </span>
                  {v.idiom}
                  <span className="ml-2 text-sm text-[var(--muted)]">&ldquo;{v.line}&rdquo;</span>
                </h2>
                <Meta label="Draws on">{v.draws}</Meta>
                <Meta label="Distinct because">{v.distinct}</Meta>
                <Meta label="Score">{v.score}</Meta>
                <Meta label="Resting HR">{v.rhr}</Meta>
                <Meta label="Prerequisite P2">{v.p2}</Meta>
              </div>
            </div>
            <div className="px-4 py-10 sm:px-6">
              <v.render view={fixture.view} />
            </div>
          </section>
        ))}
      </div>

      <footer className="px-6 py-10">
        <p className="mx-auto max-w-[1180px] text-xs leading-relaxed text-[var(--faint)]">
          Throwaway exploration on <code>dx/recovery-page-refresh</code>, gated behind{" "}
          <code>NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code>. Never merged — pick a direction, close the
          PR, and the chosen variant is reimplemented by a downstream SOW (after the P1 API
          prerequisite, which every variant carries: the page cannot draw the HRV chart at all until
          the enriched recovery view is served at page scale).
        </p>
      </footer>
    </main>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="max-w-4xl text-xs leading-relaxed text-[var(--muted)]">
      <span className="text-[var(--faint)]">{label}: </span>
      {children}
    </p>
  );
}

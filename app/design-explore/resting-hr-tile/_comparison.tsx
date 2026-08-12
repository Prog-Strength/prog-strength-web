/**
 * The `resting-hr-tile` comparison surface — THROWAWAY.
 *
 * Five variants of one proposed dashboard tile, on one screen, driven across
 * the six fixtures the ticket names. Three readings of the same five cards:
 *
 *  1. SIDE BY SIDE — all five at once, at the width a tile actually gets in the
 *     dashboard's three-column grid, for reading the spread.
 *  2. IN CONTEXT — each variant in a real `TileGrid`-shaped row beside two
 *     SHORT tiles, because the height a variant costs is paid by its whole grid
 *     row and is invisible when the variants are only compared with each other.
 *  3. FIXTURE SWEEP — one variant at a time across all six fixtures at once,
 *     which is the only way to see whether `flat-month` actually looks boring
 *     next to `creeping-up` rather than merely looking different.
 *
 * Nothing here is production code and none of it is promoted: the winning
 * direction is rebuilt by a downstream SOW.
 */

"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import type { RecoveryView } from "@/lib/dashboard";
import { FIXTURES, type FixtureKey } from "./_fixtures";
import { StepsTile, WeatherTile } from "./_neighbour-tiles";
import { DeltaLedgerVariant } from "./_variants/delta-ledger";
import { DepartureAreaVariant } from "./_variants/departure-area";
import { MonthGridVariant } from "./_variants/month-grid";
import { TrueScaleMarksVariant } from "./_variants/true-scale-marks";
import { SortedStripVariant } from "./_variants/sorted-strip";

/** The `TileGrid` shape, copied so the mockups sit at true tile width. */
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

/** The family's shared deep page — chrome each variant keeps functional. */
const HREF = "/recovery";

type Variant = {
  idiom: string;
  line: string;
  draws: string;
  distinct: string;
  polarity: string;
  axis: string;
  render: (props: { view: RecoveryView }) => ReactElement;
};

const VARIANTS: Variant[] = [
  {
    idiom: "delta-ledger",
    line: "just show me the numbers",
    draws: "Bloomberg Terminal's dense uniform dated row · Apple Health's “Show More Data” table",
    distinct:
      "13px figures over 11px deltas over 10px dates, no hero · colour is THE DELTA'S SIGN and nothing else · ten hairline rows at ~15px, strictly uniform. Prints everything, plots nothing.",
    polarity:
      "Answer 1, by wording — the column is captioned `vs 30d` and a rise is the only coloured thing on the card.",
    axis: "No axis. `flat-month` is a column of 0s and ±1s in muted ink.",
    render: ({ view }) => <DeltaLedgerVariant view={view} href={HREF} />,
  },
  {
    idiom: "departure-area",
    line: "how far from normal, and for how long?",
    draws:
      "Garmin Connect's Resting HR card (plotted against a personal band) · Whoop's history strip",
    distinct:
      "THE WIDEST RANGE IN THE SPREAD — one 28px numeral, everything else 9px · colour is FILL, above the rule only · two unequal registers, ~54px over ~90px. Plots the gap, never the value.",
    polarity:
      "Answer 1 — raw bpm, up is worse, taught by the warm fill sitting above the rule and by the headline's own wording.",
    axis: "Departure scale with a FLOOR of ±6 bpm, growing only if the month exceeds it. The floor is what saves it on `flat-month`.",
    render: ({ view }) => <DepartureAreaVariant view={view} href={HREF} />,
  },
  {
    idiom: "month-grid",
    line: "the whole month, every number, at once",
    draws: "Oura's calendar-style month views · Garmin Connect's dense summary tables",
    distinct:
      "DEAD FLAT type — 10px cells, 9px column heads, nothing else · colour is TINT AS TERRITORY around the 13% macro alpha · a strict 7-column grid at gap-[2px] with no rules at all. The densest answer.",
    polarity: "Answer 3 — no axis exists, so the question never arises; warmth alone carries it.",
    axis: "No axis. Weekly structure (weekends running high) is the only thing this layout can show that a line cannot.",
    render: ({ view }) => <MonthGridVariant view={view} href={HREF} />,
  },
  {
    idiom: "true-scale-marks",
    line: "how much does this actually move?",
    draws:
      "Oura's resting-HR graph with its lowest-point marker · Apple Health's fixed-range daily plots",
    distinct:
      "A 20px figure and 9px axis labels, nothing between · NEAR-MONOCHROME, --warning only on marks above the rule · ONE full-bleed plot register, the figure overlaid rather than stacked.",
    polarity:
      "Answer 2 — THE INVERTED AXIS, alone in the spread. Lower sits higher, so better-is-up is true here the way it is on every other tile. Endpoints read `40 lower` / `70 higher`.",
    axis: "FIXED at 40–70 bpm on every fixture. Never fitted, never auto-scaled. That is the idiom.",
    render: ({ view }) => <TrueScaleMarksVariant view={view} href={HREF} />,
  },
  {
    idiom: "sorted-strip",
    line: "is this a good morning, for me?",
    draws:
      "Robinhood's 52-week range bar with its position marker · Whoop's siting-in-your-own-distribution",
    distinct:
      "One 20px figure over 10px caption and 10px rows · POSITION IS THE MEANING, monochrome except today's tick in the upper third · a ~28px strip over a hairline over three ~18px rows.",
    polarity:
      "Answer 3, spatially — sorted ascending means LEFT IS BETTER, stated once at the strip's ends and then true everywhere.",
    axis: "No axis. The extremes are printed instead, so `flat-month` reads `48 lowest / 50 highest` and is instantly boring.",
    render: ({ view }) => <SortedStripVariant view={view} href={HREF} />,
  },
];

export function Comparison() {
  const [key, setKey] = useState<FixtureKey>("default");
  const [sweep, setSweep] = useState<string>(VARIANTS[0].idiom);
  const fixture = FIXTURES.find((f) => f.key === key) ?? FIXTURES[0];
  const swept = VARIANTS.find((v) => v.idiom === sweep) ?? VARIANTS[0];

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Design Exploration · do not merge
        </p>
        <h1 className="text-3xl tracking-[-0.03em] text-[var(--foreground)]">resting-hr-tile</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Five compositions of the same near-black / periwinkle / Manrope mini-card, for a tile the
          product does not have yet. All five print the{" "}
          <strong className="font-normal text-[var(--foreground)]">30-day baseline</strong>, show{" "}
          <strong className="font-normal text-[var(--foreground)]">actual bpm values</strong> rather
          than only a shape, render integer bpm, gate calibrating on{" "}
          <code className="text-[var(--foreground)]">restingHrAvg</code>, and follow one colour
          contract — warm above the average, neutral ink at or below,{" "}
          <code className="text-[var(--foreground)]">--surface-2</code> for an absent morning. That
          is the shared brief, not a divergence axis. They are forced apart on{" "}
          <strong className="font-normal text-[var(--foreground)]">
            whether the history is printed or plotted
          </strong>
          ,{" "}
          <strong className="font-normal text-[var(--foreground)]">
            which axis the deviation lives on
          </strong>
          , and{" "}
          <strong className="font-normal text-[var(--foreground)]">
            how they answer the polarity problem
          </strong>
          .
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-[var(--faint)]">
          The constraint behind all of it: resting HR has no band, no z-score, no status and no
          trend on the wire. This is the first recovery tile that must carry its meaning almost
          entirely without colour, and no variant classifies, re-averages, or invents a threshold.
        </p>
      </header>

      {/* Fixture driver — the house segmented control. */}
      <div className="sticky top-0 z-10 -mx-6 mt-6 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <p className="mt-2 max-w-3xl text-xs text-[var(--muted)]">{fixture.note}</p>
      </div>

      {/* Jump list — the anchors the PR body points at. */}
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {VARIANTS.map((v, i) => (
          <a key={v.idiom} href={`#${v.idiom}`} className="hover:text-[var(--accent)]">
            <span className="text-[var(--faint)]">{i + 1}.</span> {v.idiom}
          </a>
        ))}
      </nav>

      {/* 1 — the spread, at true tile width. */}
      <section className="mt-8">
        <SectionKicker>Side by side</SectionKicker>
        <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
          At the width a tile actually gets in the dashboard&rsquo;s three-column grid — including{" "}
          <code>month-grid</code>, whose 10px cells have to be judged here and not on the full-width
          mobile breakpoint.
        </p>
        <div className={`${GRID} mt-3 items-start`}>
          {VARIANTS.map((v) => (
            <div key={v.idiom} className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">
                {v.idiom}
              </p>
              <v.render view={fixture.view} />
            </div>
          ))}
        </div>
      </section>

      {/* 2 — each variant beside two short tiles, so the height cost is visible. */}
      <section className="mt-12">
        <SectionKicker>In context</SectionKicker>
        <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
          Each variant in a real dashboard row beside two short tiles. `TileGrid` has no span
          support, so the empty space under Steps and Weather is what that variant&rsquo;s height
          costs the whole row. Budget: ~180px of card body, ~260px ceiling.
        </p>

        <div className="mt-4 flex flex-col gap-10">
          {VARIANTS.map((v, i) => (
            <div key={v.idiom} id={v.idiom} className="scroll-mt-24">
              <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-4">
                <h2 className="text-lg tracking-[-0.02em] text-[var(--foreground)]">
                  <span className="text-[var(--faint)]">{i + 1}. </span>
                  {v.idiom}
                  <span className="ml-2 text-sm text-[var(--muted)]">&ldquo;{v.line}&rdquo;</span>
                </h2>
                <Meta label="Draws on">{v.draws}</Meta>
                <Meta label="Distinct because">{v.distinct}</Meta>
                <Meta label="Polarity">{v.polarity}</Meta>
                <Meta label="Axis policy">{v.axis}</Meta>
              </div>

              <div className={`${GRID} mt-3 items-start`}>
                <v.render view={fixture.view} />
                <StepsTile />
                <WeatherTile />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — one variant across every fixture at once. */}
      <section className="mt-14">
        <SectionKicker>Fixture sweep</SectionKicker>
        <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
          One variant across all six states at once. This is where{" "}
          <strong className="font-normal text-[var(--foreground)]">
            does `flat-month` look boring?
          </strong>{" "}
          gets answered — a variant only passes if the flat month is visibly calmer than the
          creeping one, sitting right beside it.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] p-1 text-xs">
          {VARIANTS.map((v) => (
            <button
              key={v.idiom}
              type="button"
              onClick={() => setSweep(v.idiom)}
              className={`rounded-[var(--radius-pill)] px-3 py-1 transition ${
                v.idiom === sweep
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {v.idiom}
            </button>
          ))}
        </div>

        <div className={`${GRID} mt-4 items-start`}>
          {FIXTURES.map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">
                {f.label}
              </p>
              <swept.render view={f.view} />
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-[var(--border)] pt-4 text-xs text-[var(--faint)]">
        Throwaway exploration on <code>dx/resting-hr-tile</code>, gated behind{" "}
        <code>NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code>. Never merged — the chosen variant is
        reimplemented by a downstream SOW, which also adds the <code>resting_hr</code> catalog entry
        this tile does not have yet.
      </footer>
    </main>
  );
}

function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
      {children}
    </h2>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="max-w-3xl text-xs text-[var(--muted)]">
      <span className="text-[var(--faint)]">{label}: </span>
      {children}
    </p>
  );
}

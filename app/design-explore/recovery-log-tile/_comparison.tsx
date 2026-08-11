/**
 * The `recovery-log-tile` comparison surface — THROWAWAY.
 *
 * Five variants of one dashboard tile, on one screen, driven across the six
 * fixtures the ticket names. Two readings of the same five cards:
 *
 *  1. SIDE BY SIDE — all five at once, at the width a tile actually gets in the
 *     dashboard's three-column grid, for reading the spread.
 *  2. IN CONTEXT — each variant in a real `TileGrid`-shaped row beside two
 *     SHORT tiles, because the height a variant costs is paid by its whole grid
 *     row and is invisible when the variants are only compared with each other.
 *
 * Nothing here is production code and none of it is promoted: the winning
 * direction is rebuilt by a downstream SOW.
 */

"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import type { RecoveryView } from "@/lib/dashboard";
import { FIXTURES, type FixtureKey } from "./_fixtures";
import { StepsTile, WeatherTile } from "./_neighbour-tiles";
import { ScoreGutterVariant } from "./_variants/score-gutter";
import { WeekColumnsVariant } from "./_variants/week-columns";
import { BandRailAndRecentVariant } from "./_variants/band-rail-and-recent";
import { BlotterLinesVariant } from "./_variants/blotter-lines";
import { BaselineLanesVariant } from "./_variants/baseline-lanes";

/** The `TileGrid` shape, copied so the mockups sit at true tile width. */
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

const HREF = "/recovery";

type Variant = {
  idiom: string;
  line: string;
  draws: string;
  distinct: string;
  render: (props: { view: RecoveryView }) => ReactElement;
};

const VARIANTS: Variant[] = [
  {
    idiom: "score-gutter",
    line: "the shipped tile, done properly",
    draws: "Linear's coloured status rail · Whoop's band vocabulary",
    distinct:
      "One ~20px numeral per row over 9px furniture · band as TERRITORY in a 3px gutter rule · seven even ~32px rows on hairlines. The tall one.",
    render: ({ view }) => <ScoreGutterVariant view={view} href={HREF} />,
  },
  {
    idiom: "week-columns",
    line: "show me the week as a grid",
    draws: "Garmin Connect's weekly summary table · Oura's weekly readiness strip",
    distinct:
      "Flat 15/12/10px, no hero · band as a FILLED CELL at 13% tint · a strict 9-column grid, gap-1, no row rules. The tightest fit.",
    render: ({ view }) => <WeekColumnsVariant view={view} href={HREF} />,
  },
  {
    idiom: "band-rail-and-recent",
    line: "the shape of the fortnight, then this morning",
    draws: "Whoop's recovery-history bar strip · Garmin Connect's summary-over-detail card",
    distinct:
      "Nothing above 13px anywhere · band as MARK HEIGHT across 14 bars · two unequal registers, ~40px over ~110px. The only one showing more than a week.",
    render: ({ view }) => <BandRailAndRecentVariant view={view} href={HREF} />,
  },
  {
    idiom: "blotter-lines",
    line: "read it like a log",
    draws: "Bloomberg Terminal's uniform log line · Linear's activity-feed density",
    distinct:
      "ONE SIZE for everything, 12px · band as exactly one COLOURED WORD per line · no grid, no rules, no padding — leading is the whole rhythm. Ten days.",
    render: ({ view }) => <BlotterLinesVariant view={view} href={HREF} />,
  },
  {
    idiom: "baseline-lanes",
    line: "where did each metric sit, relative to normal?",
    draws: "Garmin Connect's deviation-from-baseline plotting · Oura's contributor lanes",
    distinct:
      "10px labels and NO numerals in the plot · band colours the MARK, in one lane of three · three equal lanes on hairlines. The outlier: position, not figures.",
    render: ({ view }) => <BaselineLanesVariant view={view} href={HREF} />,
  },
];

export function Comparison() {
  const [key, setKey] = useState<FixtureKey>("default");
  const fixture = FIXTURES.find((f) => f.key === key) ?? FIXTURES[0];

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Design Exploration · do not merge
        </p>
        <h1 className="text-3xl tracking-[-0.03em] text-[var(--foreground)]">recovery-log-tile</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Five compositions of the same near-black / periwinkle / Manrope mini-card. All five read{" "}
          <strong className="font-normal text-[var(--foreground)]">
            Recovery → resting HR → HRV
          </strong>
          , print integer milliseconds, keep the 30-day baseline, show at least seven days, and
          paint the recovery band as the row&rsquo;s single colour system. They are forced apart on
          type scale, colour logic, and spacing rhythm — not on palette, accent, or type.
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
        <p className="mt-2 text-xs text-[var(--muted)]">{fixture.note}</p>
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
        <div className={`${GRID} mt-3`}>
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
          costs the whole row.
        </p>

        <div className="mt-4 flex flex-col gap-10">
          {VARIANTS.map((v, i) => (
            <div key={v.idiom} id={v.idiom} className="scroll-mt-24">
              <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-4">
                <h2 className="text-lg tracking-[-0.02em] text-[var(--foreground)]">
                  <span className="text-[var(--faint)]">{i + 1}. </span>
                  {v.idiom}
                  <span className="ml-2 text-sm text-[var(--muted)]">“{v.line}”</span>
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Draws on: </span>
                  {v.draws}
                </p>
                <p className="max-w-3xl text-xs text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Distinct because: </span>
                  {v.distinct}
                </p>
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

      <footer className="mt-16 border-t border-[var(--border)] pt-4 text-xs text-[var(--faint)]">
        Throwaway exploration on <code>dx/recovery-log-tile</code>, gated behind{" "}
        <code>NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code>. Never merged — the chosen variant is
        reimplemented by a downstream SOW.
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

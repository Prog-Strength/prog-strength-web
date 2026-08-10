/**
 * The interactive comparison harness for the hrv-balance-tile DX.
 *
 * Renders all five variants side by side at REAL tile width — the grid below is
 * `max-w-5xl` with `lg:grid-cols-3` and `gap-3`, exactly the dashboard's own
 * TileGrid, so a third-cell here is a third-cell there and the dot pitch a
 * reviewer judges is the pitch that ships. Driven across the six fixtures the
 * ticket names, plus an in-grid mock so the tile can be judged in the company
 * it actually keeps.
 *
 * Throwaway; nothing here is production-bound.
 */
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { RecoveryView } from "@/lib/dashboard";
import { FIXTURES, FIXTURE_ORDER, type FixtureKey } from "./_fixtures";
import { GarminStatusStack } from "./_variants/garmin-status-stack";
import { DriftField } from "./_variants/drift-field";
import { DualWindow } from "./_variants/dual-window";
import { ZLane } from "./_variants/z-lane";
import { InstrumentPlot } from "./_variants/instrument-plot";
import {
  BloodPressureNeighbor,
  MorningVitalsNeighbor,
  RecoveryTrendNeighbor,
  StepsNeighbor,
} from "./_neighbors";

type VariantDef = {
  idiom: string;
  /** The one-line "what it heroes", shown above each card. */
  heroes: string;
  /** Reference product + what specifically is taken from it. */
  draws: string;
  render: (view: RecoveryView) => ReactNode;
};

const VARIANTS: VariantDef[] = [
  {
    idiom: "garmin-status-stack",
    heroes: "Heroes the verdict, in four registers",
    draws: "Garmin Connect — its HRV Status card structure, register for register",
    render: (v) => <GarminStatusStack view={v} />,
  },
  {
    idiom: "drift-field",
    heroes: "Heroes the chart, and prints almost no type",
    draws: "Oura's normal-range zone · Whoop's full-width chart",
    render: (v) => <DriftField view={v} />,
  },
  {
    idiom: "dual-window",
    heroes: "Heroes the step between two windows",
    draws: "Garmin's 4-week chart · Robinhood's from → to delta",
    render: (v) => <DualWindow view={v} />,
  },
  {
    idiom: "z-lane",
    heroes: "Heroes the deviation, and abandons the ms axis",
    draws: "Whoop — deviation from your own normal",
    render: (v) => <ZLane view={v} />,
  },
  {
    idiom: "instrument-plot",
    heroes: "Heroes the chart furniture",
    draws: "Whoop's labelled axes and hollow points · Bloomberg's density",
    render: (v) => <InstrumentPlot view={v} />,
  },
];

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function HrvBalanceTileExplore() {
  const [fixture, setFixture] = useState<FixtureKey>("rising");
  const [inGrid, setInGrid] = useState(0);
  const active = FIXTURES[fixture];
  const view = active.view;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Design Exploration · in-system
        </p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">hrv-balance-tile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Five compositions of the same near-black / periwinkle / Manrope mini-card. All five plot{" "}
          <strong className="font-medium text-[var(--foreground)]">discrete marks</strong> and all
          five show a{" "}
          <strong className="font-medium text-[var(--foreground)]">moving baseline</strong> — that
          is the shared brief, not a divergence axis. They are forced apart on type scale, colour
          logic and spacing rhythm instead. Palette, accent and type family are settled and not
          re-litigated here. Switch the fixture to check every state; scroll for the in-grid mock.
        </p>
      </header>

      {/* Fixture switcher — the six states every variant has to survive. */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FIXTURE_ORDER.map((key) => {
          const on = key === fixture;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFixture(key)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition"
              style={{
                borderColor: on ? "var(--accent-line)" : "var(--border)",
                backgroundColor: on ? "var(--accent-soft)" : "transparent",
                color: on ? "var(--accent)" : "var(--muted)",
              }}
            >
              {FIXTURES[key].label}
            </button>
          );
        })}
      </div>
      <p className="mb-8 max-w-2xl text-xs leading-relaxed text-[var(--faint)]">{active.blurb}</p>

      {/* The five variants, at real tile width. */}
      <section className="mb-14">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          The five variants · {active.label.toLowerCase()}
        </h2>
        <div className={GRID}>
          {VARIANTS.map((v) => (
            <div key={v.idiom} id={v.idiom} className="scroll-mt-6">
              <div className="mb-2">
                <div className="font-mono text-[11px] text-[var(--accent)]">{v.idiom}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-[var(--faint)]">
                  {v.heroes}
                </div>
              </div>
              {v.render(view)}
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--faint)]">{v.draws}</p>
            </div>
          ))}
        </div>
      </section>

      {/* In-grid mock — judged in the company it actually keeps. */}
      <section id="in-grid" className="scroll-mt-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          In-grid · composition mock
        </h2>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-[var(--faint)]">
          One variant dropped into a real TileGrid beside the two siblings that already print this
          metric family — Recovery Trend, which heroes a delta, and Morning Vitals, which prints
          today&apos;s HRV — plus Steps and Blood Pressure. Two questions here: does the tile stay
          distinct from its siblings, and is it calm enough to sit next to them?
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {VARIANTS.map((v, i) => {
            const on = i === inGrid;
            return (
              <button
                key={v.idiom}
                type="button"
                onClick={() => setInGrid(i)}
                className="rounded-full border px-3 py-1 font-mono text-[11px] transition"
                style={{
                  borderColor: on ? "var(--accent-line)" : "var(--border)",
                  backgroundColor: on ? "var(--accent-soft)" : "transparent",
                  color: on ? "var(--accent)" : "var(--muted)",
                }}
              >
                {v.idiom}
              </button>
            );
          })}
        </div>
        <div className={GRID}>
          {VARIANTS[inGrid].render(view)}
          <RecoveryTrendNeighbor />
          <MorningVitalsNeighbor />
          <StepsNeighbor />
          <BloodPressureNeighbor />
        </div>
      </section>

      <footer className="mt-16 border-t border-[var(--border)] pt-4 text-[11px] leading-relaxed text-[var(--faint)]">
        Throwaway exploration · flag-gated behind{" "}
        <code className="text-[var(--muted)]">NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code> · never
        merged — the chosen variant is reimplemented by a downstream SOW.
      </footer>
    </div>
  );
}

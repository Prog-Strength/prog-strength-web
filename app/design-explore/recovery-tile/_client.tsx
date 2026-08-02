/**
 * The interactive comparison harness for the recovery-tile DX.
 *
 * Renders all five variants side by side at real tile width, across a fixture
 * switcher (suppressed / balanced / calibrating / no-reading-yet), plus a
 * pair-in-grid mock — two recovery variants dropped into a real dashboard
 * CardGrid beside Steps and Blood Pressure — so composition can actually be
 * judged. Throwaway; nothing here is production-bound.
 */
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FIXTURES, FIXTURE_ORDER, type FixtureKey } from "./_fixtures";
import { BalanceBand } from "./_variants/balance-band";
import { ReadinessVerdict } from "./_variants/readiness-verdict";
import { ThreeDialVitals } from "./_variants/three-dial-vitals";
import { TrendRail } from "./_variants/trend-rail";
import { MorningLedger } from "./_variants/morning-ledger";
import { StepsNeighbor, BloodPressureNeighbor } from "./_neighbors";
import type { RecoveryView } from "@/lib/dashboard";

type VariantDef = {
  idiom: string;
  title: string;
  draws: string;
  render: (view: RecoveryView) => ReactNode;
};

const VARIANTS: VariantDef[] = [
  {
    idiom: "balance-band",
    title: "HRV Balance",
    draws: "Oura — the personal ‘your normal range’ band",
    render: (v) => <BalanceBand view={v} />,
  },
  {
    idiom: "readiness-verdict",
    title: "Recovery",
    draws: "The Athletic — the authored headline sentence",
    render: (v) => <ReadinessVerdict view={v} />,
  },
  {
    idiom: "three-dial-vitals",
    title: "Morning Vitals",
    draws: "Garmin Connect — the morning-snapshot stat grid",
    render: (v) => <ThreeDialVitals view={v} />,
  },
  {
    idiom: "trend-rail",
    title: "Recovery Trend",
    draws: "Robinhood delta headline · GitHub contribution rail",
    render: (v) => <TrendRail view={v} />,
  },
  {
    idiom: "morning-ledger",
    title: "Recovery Log",
    draws: "Robinhood list rows · Whoop daily-log density",
    render: (v) => <MorningLedger view={v} />,
  },
];

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function RecoveryTileExplore() {
  const [fixture, setFixture] = useState<FixtureKey>("suppressed");
  const active = FIXTURES[fixture];
  const view = active.view;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Design Exploration · in-system
        </p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">recovery-tile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Five compositions of the same near-black / periwinkle / Manrope mini-card, each heroing a
          different element of the recovery payload and leaning on a different reference. These are
          candidate <em>catalog tiles</em> with non-overlapping jobs, not five renderings of one
          idea — the likely outcome is that two or three ship together. Switch the fixture to check
          every state; scroll for the pair-in-grid mock.
        </p>
      </header>

      {/* Fixture switcher — the states every variant must survive. */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FIXTURE_ORDER.map((key) => {
          const f = FIXTURES[key];
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
              {f.label}
            </button>
          );
        })}
      </div>
      <p className="mb-8 text-xs text-[var(--faint)]">{active.blurb}</p>

      {/* Variants side by side at real tile width. */}
      <section className="mb-14">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          The five variants · {active.label.toLowerCase()} state
        </h2>
        <div className={GRID}>
          {VARIANTS.map((v) => (
            <div key={v.idiom} id={v.idiom} className="scroll-mt-6">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-[var(--accent)]">{v.idiom}</span>
                <span className="text-[10px] text-[var(--faint)]">{v.title}</span>
              </div>
              {v.render(view)}
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--faint)]">{v.draws}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pair-in-grid mock — judged as they'd actually sit on a dashboard. */}
      <section id="pair-in-grid" className="scroll-mt-6">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Pair-in-grid · composition mock
        </h2>
        <p className="mb-4 max-w-2xl text-xs text-[var(--faint)]">
          The interpretive tile (HRV Balance) and the raw-numbers tile (Morning Vitals) on one real
          CardGrid beside Steps and Blood Pressure — plus Recovery Trend, the direction complement.
          The selection question is whether a pairing reads as two facts or one fact printed twice.
          Fixture: {active.label.toLowerCase()}.
        </p>
        <div className={GRID}>
          <BalanceBand view={view} />
          <StepsNeighbor />
          <ThreeDialVitals view={view} />
          <BloodPressureNeighbor />
          <TrendRail view={view} />
        </div>
      </section>

      <footer className="mt-16 border-t border-[var(--border)] pt-4 text-[11px] text-[var(--faint)]">
        Throwaway exploration · flag-gated behind{" "}
        <code className="text-[var(--muted)]">NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code> · never
        merged — the chosen variants are reimplemented by a downstream SOW.
      </footer>
    </div>
  );
}

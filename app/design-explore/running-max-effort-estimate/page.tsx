"use client";

/**
 * DESIGN EXPLORATION — running-max-effort-estimate · DO NOT MERGE
 *
 * Throwaway comparison route that renders all five idiom variants of the
 * max-effort-estimate surface side by side on one screen so a human can pick a
 * direction. See dx/running-max-effort-estimate.md.
 *
 * GATED: only reachable when NEXT_PUBLIC_DESIGN_EXPLORE=1 (see lib/config.ts).
 * Off by default → dead in production, never wired into product navigation.
 * Lives OUTSIDE the (app) route group, so it has no sidebar and no auth gate —
 * it is a pure design surface rendering static fixtures, never live data.
 *
 * scope: in-system — every variant uses the oura-calm tokens (periwinkle
 * accent, sage accent-2, near-black ramp, Manrope, status colours). The spread
 * is composition only: which element is the hero, how uncertainty / the gap /
 * the trend are encoded, and the density. No variant re-decides palette or type.
 */

import { useState } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { FIXTURES, type FixtureKey } from "./_shared/fixtures";
import { SingleNumberHero } from "./_variants/SingleNumberHero";
import { ProjectionChartForward } from "./_variants/ProjectionChartForward";
import { EstimateVsActualGap } from "./_variants/EstimateVsActualGap";
import { ConfidenceLedger } from "./_variants/ConfidenceLedger";
import { TrendNarrative } from "./_variants/TrendNarrative";
import type { RunningMaxEffortDetail } from "@/lib/api";

type VariantMeta = {
  id: string;
  idiom: string;
  reference: string;
  distinct: string;
  Component: (props: { detail: RunningMaxEffortDetail }) => React.ReactElement;
};

// Ticket order — one entry per idiom.
const VARIANTS: VariantMeta[] = [
  {
    id: "single-number-hero",
    idiom: "single-number-hero",
    reference: "Whoop — one big confident metric",
    distinct:
      "Dramatic type scale: one hero numeral, the confidence range carried in the subtitle. Near-monochrome; accent spent only on the number.",
    Component: SingleNumberHero,
  },
  {
    id: "projection-chart-forward",
    idiom: "projection-chart-forward",
    reference: "FiveThirtyEight — forecast cone of uncertainty",
    distinct:
      "Chart-scale hierarchy: the plot is the hero with a forward cone that widens into doubt; numbers demote to axis + caption.",
    Component: ProjectionChartForward,
  },
  {
    id: "estimate-vs-actual-gap",
    idiom: "estimate-vs-actual-gap",
    reference: "MacroFactor — predicted vs actual",
    distinct:
      "Balanced two-column rhythm: projection vs proof with the signed delta as the centerpiece; the gap is the encoded thing.",
    Component: EstimateVsActualGap,
  },
  {
    id: "confidence-ledger",
    idiom: "confidence-ledger",
    reference: "Runalyze — prognosis transparency",
    distinct:
      "Dense, gridded, mono-numeral report; hierarchy from alignment. Colour-as-state only; attempts promoted to weighted evidence.",
    Component: ConfidenceLedger,
  },
  {
    id: "trend-narrative",
    idiom: "trend-narrative",
    reference: "Oura — calm trend cards",
    distinct:
      "Editorial scale + a sequential timeline; the trend is a stated headline and each attempt is an annotated milestone.",
    Component: TrendNarrative,
  },
];

export default function DesignExplorePage() {
  // Hard env gate — the route 404s unless explicitly enabled on a preview.
  if (!config.designExplore) {
    notFound();
  }

  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("representative");
  const fixture = FIXTURES.find((f) => f.key === fixtureKey) ?? FIXTURES[0];

  return (
    <main className="min-h-full overflow-y-auto bg-[var(--background)]">
      {/* sticky control bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Design Exploration · do not merge
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em]">
                running-max-effort-estimate
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Five compositions of the same surface — pick a direction, not a winner-by-skin.
              </p>
            </div>
            <nav className="flex flex-wrap gap-1.5 text-xs">
              {VARIANTS.map((v, i) => (
                <a
                  key={v.id}
                  href={`#${v.id}`}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  {i + 1}. {v.idiom}
                </a>
              ))}
            </nav>
          </div>

          {/* fixture-state switcher — re-renders every variant in a chosen state */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                State
              </span>
              {FIXTURES.map((f) => {
                const active = f.key === fixtureKey;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFixtureKey(f.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-[var(--surface-2)] text-[var(--foreground)] ring-1 ring-[var(--accent)]"
                        : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--faint)]">{fixture.note}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        {VARIANTS.map((v, i) => {
          const Variant = v.Component;
          return (
            <section key={v.id} id={v.id} className="scroll-mt-40">
              {/* variant label + idiom mapping */}
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                  {i + 1}
                </span>
                <h2 className="text-lg font-semibold tracking-[-0.01em]">{v.idiom}</h2>
                <span className="text-xs text-[var(--muted)]">— draws on {v.reference}</span>
              </div>
              <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
                {v.distinct}
              </p>

              {/* the variant, framed as the real surface would be */}
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
                <Variant detail={fixture.detail} />
              </div>
            </section>
          );
        })}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--faint)]">
          Disposable exploration · NEXT_PUBLIC_DESIGN_EXPLORE-gated · static fixtures, never live
          data. The chosen direction is reimplemented by a downstream SOW.
        </footer>
      </div>
    </main>
  );
}

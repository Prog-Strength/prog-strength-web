/**
 * Design Exploration comparison route — pace-trace. THROWAWAY.
 *
 * Renders all five idiom variants of the run-detail pace trace on one screen so
 * a human can compare directions and pick one. Gated by the single shared DX
 * flag (`config.designExploreEnabled`, backed by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE):
 * unset in production → 404; set truthy on a Vercel preview → visible. This is
 * additive and never imported by any production route.
 *
 * Each variant is a self-contained component under _components/. Duplication
 * between them is intentional — the value is the spread, not shared abstraction.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { ALL_STATES, PRIMARY, type Fixture } from "./_components/fixtures";
import { VariantEditorialAreaRecap } from "./_components/VariantEditorialAreaRecap";
import { VariantTerminalDenseAnalytical } from "./_components/VariantTerminalDenseAnalytical";
import { VariantSplitAlignedBars } from "./_components/VariantSplitAlignedBars";
import { VariantWarmOrganicRollingBand } from "./_components/VariantWarmOrganicRollingBand";
import { VariantLinearMinimalGradientStrip } from "./_components/VariantLinearMinimalGradientStrip";

type VariantComp = ({
  fixture,
  compact,
}: {
  fixture: Fixture;
  compact?: boolean;
}) => React.ReactNode;

const VARIANTS: {
  id: string;
  idiom: string;
  drawsOn: string;
  distinct: string;
  Comp: VariantComp;
}[] = [
  {
    id: "editorial-area-recap",
    idiom: "editorial-area-recap",
    drawsOn: "Strava's run-recap area chart — area-fill-as-hero with an inline split annotation",
    distinct:
      "Hero prominence · large editorial type · labelled mm:ss y-axis + distance x-axis · single low-opacity accent fill",
    Comp: VariantEditorialAreaRecap,
  },
  {
    id: "terminal-dense-analytical",
    idiom: "terminal-dense-analytical",
    drawsOn:
      "Runalyze's gridded pace/power traces — full grid, pace-zone bands, every point readable",
    distinct:
      "Maximal data-ink · small monospace tabular numerals on both axes · tight grid rhythm · no annotation",
    Comp: VariantTerminalDenseAnalytical,
  },
  {
    id: "split-aligned-bars",
    idiom: "split-aligned-bars",
    drawsOn:
      "Apple Fitness + Garmin Connect split breakdowns — bar-per-split legibility, fastest/slowest emphasis",
    distinct:
      "Abandons the line for ledger-aligned bars · even row rhythm · medium type · dropout = one hatched bar",
    Comp: VariantSplitAlignedBars,
  },
  {
    id: "warm-organic-rolling-band",
    idiom: "warm-organic-rolling-band",
    drawsOn: "the calm end of Strava + Apple Fitness — a smoothed pace curve over raw samples",
    distinct:
      "Rolling-average signal + faint variability envelope · soft curve · warmer run-hue, low contrast · label-light",
    Comp: VariantWarmOrganicRollingBand,
  },
  {
    id: "linear-minimal-gradient-strip",
    idiom: "linear-minimal-gradient-strip",
    drawsOn:
      "Whoop's single-accent-on-charcoal effort bands — reads through colour intensity, not gridlines",
    distinct:
      "Tightest footprint · colour-encoded effort band (brighter = faster) · 3 anchor labels · maximal restraint",
    Comp: VariantLinearMinimalGradientStrip,
  },
];

const STATE_LABELS = ["Dense (18 km)", "Sparse (1.8 km)", "Empty"];

export default function PaceTraceDesignExplore() {
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="mx-auto max-w-[960px] px-6 py-10">
      <header className="mb-10 border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
          Design Exploration · DO NOT MERGE
        </p>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          pace-trace — 5 variants
        </h1>
        <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-[var(--muted)]">
          Five forms for the run-detail pace trace — the strip that should answer{" "}
          <em>&ldquo;where did I speed up and where did I fade?&rdquo;</em> at a glance. Each
          variant is one idiom: a different chart form with its own type scale, colour logic, and
          spacing rhythm, all within the v0.4 design system (one accent, soft near-black ramp,
          Manrope). Every variant handles the same four states — primary, dense, sparse, and empty.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {VARIANTS.map((v) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {v.idiom}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-14">
        {VARIANTS.map((v, i) => {
          const { Comp } = v;
          return (
            <section key={v.id} id={v.id} className="scroll-mt-6">
              <div className="mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="tabular-nums text-[13px] font-semibold text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                    {v.idiom}
                  </h2>
                </div>
                <p className="mt-1 pl-8 text-[13px] text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Draws on</span> {v.drawsOn}
                </p>
                <p className="mt-0.5 pl-8 text-[13px] text-[var(--muted)]">
                  <span className="text-[var(--faint)]">Distinct because</span> {v.distinct}
                </p>
              </div>

              {/* primary / hero render */}
              <Comp fixture={PRIMARY} />

              {/* the three edge states, compact */}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {ALL_STATES.map((s, si) => (
                  <div key={si}>
                    <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
                      {STATE_LABELS[si]}
                    </p>
                    <Comp fixture={s} compact />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="mt-16 border-t border-[var(--border)] pt-6 text-[12px] text-[var(--faint)]">
        Throwaway exploration on branch <code className="text-[var(--muted)]">dx/pace-trace</code>.
        Never merged — the chosen variant is reimplemented by a downstream SOW.
      </footer>
    </main>
  );
}

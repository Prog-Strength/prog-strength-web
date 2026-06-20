/**
 * DESIGN EXPLORATION — personal-records · DO NOT MERGE
 * ---------------------------------------------------------------------------
 * One throwaway comparison screen rendering five genuinely different visual
 * variants of the Personal Records surface, side by side, each labelled with
 * its idiom so a human can pick a direction at the selection gate. The value
 * is the SPREAD — the variants diverge on layout, density, structure, and
 * composition, all strictly within design-system v0.4 (scope: in-system):
 * same near-black ramp, same discipline hues, same Manrope, periwinkle accent
 * kept to selection chrome.
 *
 * Gated by the single shared DX flag (config.designExploreEnabled, backed by
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE): unset in production so the route 404s,
 * set truthy on the Vercel preview deploy to review variants. This route is
 * purely additive — it touches no production code path.
 *
 * See prog-strength-docs/dx/personal-records.md.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { CompactDashboardRail } from "./_variants/CompactDashboardRail";
import { EditorialSpotlight } from "./_variants/EditorialSpotlight";
import { ProgressionTimeline } from "./_variants/ProgressionTimeline";
import { GaugeGrid } from "./_variants/GaugeGrid";
import { SplitMasterDetail } from "./_variants/SplitMasterDetail";

const VARIANTS: {
  id: string;
  idiom: string;
  draws: string;
  distinct: string;
  Component: () => React.JSX.Element;
}[] = [
  {
    id: "compact-dashboard-rail",
    idiom: "compact-dashboard-rail",
    draws: "Linear's compact tabular density · Whoop's single-accent stat cards",
    distinct: "Tightest type scale, hairline grid, a docked featured rail filling the dead space",
    Component: CompactDashboardRail,
  },
  {
    id: "editorial-spotlight",
    idiom: "editorial-spotlight",
    draws: "Apple Fitness's summary-hero · Strava's 'trending toward a PR' framing",
    distinct: "Inverted hierarchy — a large hero chart up top, the grid demoted to a roomy list",
    Component: EditorialSpotlight,
  },
  {
    id: "progression-timeline",
    idiom: "progression-timeline",
    draws: "Garmin Connect's progression charts · GitHub's contribution-rail scanning",
    distinct: "Trend-first — each record is a full-width row the progression line dominates",
    Component: ProgressionTimeline,
  },
  {
    id: "gauge-grid",
    idiom: "gauge-grid",
    draws: "Whoop's recovery-ring · Oura's gauge-as-progress",
    distinct: "Readiness as geometry — a radial gauge sweeping toward and past the PR mark",
    Component: GaugeGrid,
  },
  {
    id: "split-master-detail",
    idiom: "split-master-detail",
    draws: "Linear's & Robinhood's master-detail list-plus-chart",
    distinct: "A two-pane ledger — a readiness-ranked list left, a pinned chart right",
    Component: SplitMasterDetail,
  },
];

export default function PersonalRecordsDesignExplore() {
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/60 px-6 py-5 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Design Exploration · do not merge
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Personal Records — 5 variants
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Five takes on the trophy case, each rendering both Lifts and Running through one shared
            card system and surfacing the estimate as progress toward a new best. They diverge on
            layout and density only — same tokens throughout (scope: in-system).
          </p>
          <nav className="mt-3 flex flex-wrap gap-2">
            {VARIANTS.map((v, i) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                {i + 1}. {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {VARIANTS.map((v, i) => (
          <section key={v.id} id={v.id} className="scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-semibold tabular-nums text-[var(--faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-base font-semibold tracking-tight">{v.idiom}</h2>
              <span className="text-xs text-[var(--muted)]">{v.distinct}</span>
            </div>
            <p className="mb-3 text-[11px] uppercase tracking-wide text-[var(--faint)]">
              Draws on — {v.draws}
            </p>
            <v.Component />
          </section>
        ))}
      </div>

      <footer className="border-t border-[var(--border)] px-6 py-6 text-center text-xs text-[var(--faint)]">
        Disposable exploration · gated by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE · the chosen direction
        is reimplemented by a downstream SOW.
      </footer>
    </main>
  );
}

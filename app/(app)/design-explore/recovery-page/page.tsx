import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { ReadinessCommandHero } from "./_components/variant-readiness-command-hero";
import { MorningReport } from "./_components/variant-morning-report";
import { BandedTrendCanvas } from "./_components/variant-banded-trend-canvas";
import { SplitLedgerControlRoom } from "./_components/variant-split-ledger-control-room";
import { BandedWeekRail } from "./_components/variant-banded-week-rail";

/**
 * Recovery page Design Exploration (DX) — comparison route.
 *
 * Renders all five recovery-page variants on one screen, each labeled with its
 * idiom, so a human can compare directions and pick one at the selection gate.
 * This is a THROWAWAY exploration: it never merges, ships no production code,
 * and is reachable only when the single shared DX flag is on
 * (config.designExploreEnabled / NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE) — unset in
 * production, so the route notFound()s and is dead there.
 *
 * Every variant under _components/ is self-contained and duplicative on
 * purpose — divergence is the goal, not shared abstraction. All five run off
 * the same static fixtures (no live Whoop services) and honor the DX's fixed
 * decisions: no dead hero (the fixture has no row for today), a compact
 * paginated ledger, a "Manage Whoop connection →" backlink, and band color
 * deployed within the design system. See dx/recovery-page.md for idiom
 * grounding.
 */

const VARIANTS = [
  {
    id: "readiness-command-hero",
    title: "readiness-command-hero",
    draws: "Whoop's today-screen recovery ring",
    note: "Ring stays the hero but never empties — dashed window-avg fill; one huge numeral; the band hue floods the page.",
    Component: ReadinessCommandHero,
  },
  {
    id: "morning-report",
    title: "morning-report",
    draws: "Oura's readiness briefing",
    note: "A daily report, not a dashboard — verdict sentence + contributor rows with baseline deltas & sparklines; color at its most restrained (band dots only).",
    Component: MorningReport,
  },
  {
    id: "banded-trend-canvas",
    title: "banded-trend-canvas",
    draws: "Apple Health's single-metric detail",
    note: "The score chart is the page — the three bands become large translucent background fields; on-plot average + ringed latest point.",
    Component: BandedTrendCanvas,
  },
  {
    id: "split-ledger-control-room",
    title: "split-ledger-control-room",
    draws: "Linear's composure + Garmin Connect's tabular history",
    note: "Two-pane working surface — charts left, a permanent dense paginated ledger right; hovering a row highlights its point. The tightest of the five.",
    Component: SplitLedgerControlRoom,
  },
  {
    id: "banded-week-rail",
    title: "banded-week-rail",
    draws: "Whoop's trend calendar + GitHub contribution cells",
    note: "A rail of band-colored day cells is the spine — scrub a cell to drive the detail panel; all the color concentrates in the rail.",
    Component: BandedWeekRail,
  },
] as const;

export default function RecoveryDesignExplorePage() {
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Recovery — Design Exploration</h1>
          <span className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning)]">
            DX · do not merge
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Five differentiated directions for the recovery surface, side by side — all rendered in
          the &ldquo;no data yet today&rdquo; state (the fixture has no row for today). Pick one;
          this route never ships.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2">
          {VARIANTS.map((v, i) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              {i + 1}. {v.title}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto">
        {VARIANTS.map((v, i) => {
          const { Component } = v;
          return (
            <section key={v.id} id={v.id} className="scroll-mt-4 border-b border-[var(--border)]">
              <div className="sticky top-0 z-20 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur">
                <span className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">
                  {i + 1} · {v.title}
                </span>
                <span className="text-xs text-[var(--faint)]">draws on {v.draws}</span>
                <span className="w-full text-xs text-[var(--muted)] lg:w-auto lg:flex-1">
                  {v.note}
                </span>
              </div>
              <div className="px-4 py-10 sm:px-6">
                <Component />
              </div>
            </section>
          );
        })}

        <footer className="px-6 py-10 text-center text-xs text-[var(--faint)]">
          Disposable exploration · dx/recovery-page · the chosen variant is reimplemented via a
          downstream SOW.
        </footer>
      </div>
    </main>
  );
}

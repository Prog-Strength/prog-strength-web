"use client";

/**
 * Comparison shell for the bodyweight-page DX. Stacks the five variants,
 * each in a labelled "surface" frame with a jump anchor, on one screen.
 * Disposable mockup chrome — not a product surface.
 */

import { TrendBandAnalyst } from "./_variants/trend-band-analyst";
import { SingleMetricHero } from "./_variants/single-metric-hero";
import { WeighInJournal } from "./_variants/weigh-in-journal";
import { CalmCanvas } from "./_variants/calm-canvas";
import { SplitControlRoom } from "./_variants/split-control-room";

const VARIANTS = [
  {
    id: "trend-band-analyst",
    n: 1,
    title: "Trend Band Analyst",
    draws: "TrendWeight / Libra",
    note: "Smoothed EWMA trend in violet as the unmistakable subject, raw readings demoted to faint slate, wrapped in a ±spread band with a rate-of-change readout.",
    Component: TrendBandAnalyst,
  },
  {
    id: "single-metric-hero",
    n: 2,
    title: "Single Metric Hero",
    draws: "Whoop / Oura",
    note: "A huge Oswald hero numeral with a direction arrow + range delta and a quiet sparkline — the half-second 'where am I at' hit. Chart and log sit calmly below.",
    Component: SingleMetricHero,
  },
  {
    id: "weigh-in-journal",
    n: 3,
    title: "Weigh-in Journal",
    draws: "Editorial / log-first",
    note: "The log is the star: a dated journal feed with delta chips and morning/evening pairs grouped under their day. The chart shrinks to a slim strip on top.",
    Component: WeighInJournal,
  },
  {
    id: "calm-canvas",
    n: 4,
    title: "Calm Canvas",
    draws: "Apple Health + Linear",
    note: "One large quiet chart; the stat tiles dissolve into on-plot annotations (min/max/avg/goal labelled on the curve). The log folds into a drawer.",
    Component: CalmCanvas,
  },
  {
    id: "split-control-room",
    n: 5,
    title: "Split Control Room",
    draws: "Linear",
    note: "A dense two-pane working surface: chart + trend stats on the left, the full weigh-in ledger permanently visible on the right. Hovering a row lights its point.",
    Component: SplitControlRoom,
  },
];

export function ComparisonView() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-strong)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
              DX · do not merge
            </span>
            <h1 className="text-lg font-extrabold tracking-tight">Bodyweight page — 5 variants</h1>
            <span className="text-xs text-[var(--muted)]">
              in-system · pick a direction, then close the PR
            </span>
          </div>
          <nav className="flex flex-wrap gap-2 text-xs">
            {VARIANTS.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-semibold text-[var(--muted)] transition hover:border-[var(--accent-line)] hover:text-[var(--foreground)]"
              >
                <span className="text-[var(--accent)]">{v.n}</span> {v.title}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8 sm:py-12">
        {VARIANTS.map((v) => (
          <section key={v.id} id={v.id} className="scroll-mt-28">
            <div className="mb-4 flex flex-col gap-1 border-l-2 border-[var(--accent-line)] pl-3">
              <div className="flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[var(--accent)]">
                  {String(v.n).padStart(2, "0")}
                </span>
                <h2 className="text-xl font-extrabold tracking-tight">{v.title}</h2>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">
                  draws on {v.draws}
                </span>
              </div>
              <p className="max-w-3xl text-sm text-[var(--muted)]">{v.note}</p>
            </div>
            {/* Surface frame — mimics the in-app content column so each
                variant reads as a real page, not a loose component. */}
            <div className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-3)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-3)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-3)]" />
                <span className="ml-2 text-[11px] font-medium text-[var(--faint)]">
                  prog-strength · /bodyweight · {v.id}
                </span>
              </div>
              <v.Component />
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          Disposable design exploration · five throwaway variants of{" "}
          <code className="text-[var(--foreground)]">/bodyweight</code> · never merged. The chosen
          direction is reimplemented by a downstream SOW.
        </footer>
      </main>
    </div>
  );
}

/**
 * DESIGN EXPLORATION — timeline (DO NOT MERGE / not production)
 *
 * A throwaway comparison surface that renders five genuinely different visual
 * directions ("idioms") for the social timeline feed, side by side, so a human
 * can pick a direction at the selection gate. See prog-strength-docs/dx/timeline.md.
 *
 * This route is GATED behind config.designExploreEnabled
 * (NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE=true). It is unreachable from normal
 * navigation (no sidebar entry, outside the (app) auth shell) and dead in
 * production where the flag is unset → notFound(). The variant components are
 * disposable mockups on static fixtures; the chosen one gets reimplemented
 * properly by a downstream SOW, conforming to the design system.
 */
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { StravaSocialDashboard } from "./_variants/StravaSocialDashboard";
import { GarminFeedLeaderboard } from "./_variants/GarminFeedLeaderboard";
import { EditorialMilestoneJournal } from "./_variants/EditorialMilestoneJournal";
import { TerminalActivityLedger } from "./_variants/TerminalActivityLedger";
import { SoftCoachingCommunity } from "./_variants/SoftCoachingCommunity";

type Variant = {
  id: string;
  idiom: string;
  draws_on: string;
  distinct: string;
  Component: () => React.ReactElement;
};

// Order matches the DX ticket's `idioms:` list exactly.
const VARIANTS: Variant[] = [
  {
    id: "strava-social-dashboard",
    idiom: "strava-social-dashboard",
    draws_on: "Strava's three-column dashboard + labeled stat row + route map",
    distinct:
      "Condensed athletic sans · photographic map + one orange accent · generous, card-forward",
    Component: StravaSocialDashboard,
  },
  {
    id: "garmin-feed-leaderboard",
    idiom: "garmin-feed-leaderboard",
    draws_on:
      "Garmin Connect's metric-dense cards + Weekly Leaderboard rail with a metric switcher",
    distinct: "Small utilitarian sans + tabular numerals · category-coded · tight, gridded",
    Component: GarminFeedLeaderboard,
  },
  {
    id: "editorial-milestone-journal",
    idiom: "editorial-milestone-journal",
    draws_on:
      "A magazine read of Linear's typographic restraint — display serif, oversized numerals",
    distinct:
      "Dramatic serif scale · neutral + one gold accent for milestones · columnar, wide leading",
    Component: EditorialMilestoneJournal,
  },
  {
    id: "terminal-activity-ledger",
    idiom: "terminal-activity-ledger",
    draws_on: "Linear's dense panes pushed to a monospace activity log",
    distinct:
      "Uniform mono, hierarchy by weight/indent · single lime accent on graphite · dense, ledgered",
    Component: TerminalActivityLedger,
  },
  {
    id: "soft-coaching-community",
    idiom: "soft-coaching-community",
    draws_on: "Whoop's warm single-accent, big metrics, coaching tone",
    distinct: "Rounded comfortable sans · warm tonal hues + clay accent · generous, rounded",
    Component: SoftCoachingCommunity,
  },
];

export default function DesignExploreTimelinePage() {
  // Dead in production: the flag is unset, so this route 404s.
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="rounded bg-[var(--warning)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
              DX · DO NOT MERGE
            </span>
            <h1 className="text-lg font-semibold tracking-tight">Timeline — 5 design variants</h1>
            <span className="text-xs text-[var(--muted)]">
              scope: greenfield · static fixtures · flag-gated
            </span>
          </div>
          <nav className="mt-3 flex flex-wrap gap-2">
            {VARIANTS.map((v, i) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {i + 1}. {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-10">
        {VARIANTS.map((v, i) => (
          <section key={v.id} id={v.id} className="scroll-mt-28">
            <div className="mb-4 border-l-2 border-[var(--accent)] pl-3">
              <h2 className="text-base font-semibold">
                <span className="text-[var(--muted)]">Variant {i + 1} —</span> {v.idiom}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">Draws on:</span> {v.draws_on}
              </p>
              <p className="text-xs text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">Distinct because:</span>{" "}
                {v.distinct}
              </p>
            </div>
            <v.Component />
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--muted)]">
          Disposable exploration · pick a direction at the selection gate, then close the PR (never
          merge) and open a SOW.
        </footer>
      </div>
    </main>
  );
}

/**
 * DESIGN EXPLORATION — comparison route for `activities-overview`.
 *
 * Renders all five idiom variants on ONE screen, each in a frame that mimics
 * the real Activities → Overview surface chrome (period filter + tab bar), so
 * a reviewer can compare directions side by side and pick one.
 *
 * THROWAWAY. Gated by the single shared DX flag (config.designExploreEnabled,
 * backed by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE): unset in production → 404,
 * truthy on a Vercel preview → visible. Never merged; the chosen direction is
 * reimplemented by a downstream SOW. See dx/activities-overview.md.
 */
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import HeadlineDigest from "./_variants/headline-digest";
import DisciplineColumns from "./_variants/discipline-columns";
import CommandStripDense from "./_variants/command-strip-dense";
import ConsistencyHeatmap from "./_variants/consistency-heatmap";
import InstrumentPanel from "./_variants/instrument-panel";

type Variant = {
  idiom: string;
  reference: string;
  blurb: string;
  Component: () => React.ReactElement;
};

// Ticket order — one entry per idiom.
const VARIANTS: Variant[] = [
  {
    idiom: "headline-digest",
    reference: "The Athletic",
    blurb: "Authored summary — one oversized lead figure, consistency narrated.",
    Component: HeadlineDigest,
  },
  {
    idiom: "discipline-columns",
    reference: "Garmin Connect",
    blurb: "Parity across disciplines — Lifting / Running / Steps as equal columns.",
    Component: DisciplineColumns,
  },
  {
    idiom: "command-strip-dense",
    reference: "Whoop",
    blurb: "Glanceable console — a dense KPI strip, hierarchy from position.",
    Component: CommandStripDense,
  },
  {
    idiom: "consistency-heatmap",
    reference: "Oura",
    blurb: "Show-up record — the days-active heatmap as the hero.",
    Component: ConsistencyHeatmap,
  },
  {
    idiom: "instrument-panel",
    reference: "Strava",
    blurb: "Panel of trends — a grid of small-multiple charts, graphs first.",
    Component: InstrumentPanel,
  },
];

export default function DesignExploreActivitiesOverview() {
  // THE standard DX gate — reuse the shared flag verbatim. Never a per-surface flag.
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Exploration header — orients the reviewer; not part of any variant. */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/40 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Design Exploration · DO NOT MERGE
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Activities → Overview — 5 variants
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Five in-system idioms of the Overview tab, each rendering the same representative{" "}
            <span className="text-[var(--foreground)]">Last 90 days</span> fixture (a training
            quarter with a rest-week trough, lift+run mix, and pace-less manual runs). They diverge
            on composition, density, and which metrics lead — not on palette, accent, or type.
          </p>
          <nav className="mt-4 flex flex-wrap gap-2">
            {VARIANTS.map((v, i) => (
              <a
                key={v.idiom}
                href={`#${v.idiom}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                {i + 1}. {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10">
        {VARIANTS.map((v, i) => (
          <section key={v.idiom} id={v.idiom} className="scroll-mt-6">
            {/* Variant label */}
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                {i + 1}
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{v.idiom}</h2>
              <span className="text-xs uppercase tracking-wider text-[var(--faint)]">
                draws on {v.reference}
              </span>
            </div>
            <p className="mb-4 text-sm text-[var(--muted)]">{v.blurb}</p>

            {/* Surface frame — mimics the real Activities chrome so each
                variant reads as the native Overview surface. */}
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
              <SurfaceChrome />
              <div className="px-4 py-2 sm:px-6">
                <v.Component />
              </div>
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          Disposable exploration · branch{" "}
          <code className="text-[var(--foreground)]">dx/activities-overview</code> · gated by{" "}
          <code className="text-[var(--foreground)]">NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE</code>. Never
          merged — the chosen direction feeds a downstream SOW.
        </footer>
      </div>
    </main>
  );
}

/** Static reproduction of the Activities page chrome (header + period pills +
 *  tab bar) so variants render in context. Functional-looking, not wired. */
function SurfaceChrome() {
  const periods = ["7", "30", "90", "All"];
  const tabs = ["Overview", "Workouts", "Running", "Steps"];
  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-3 pt-4 sm:px-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight">Activities</h3>
        <div className="flex gap-1.5">
          {periods.map((p) => (
            <span
              key={p}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                p === "90"
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border border-[var(--border)] text-[var(--faint)]"
              }`}
            >
              {p === "All" ? "All" : `${p}d`}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-5 border-t border-[var(--border)] pt-2 text-xs">
        {tabs.map((t) => (
          <span
            key={t}
            className={
              t === "Overview" ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"
            }
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

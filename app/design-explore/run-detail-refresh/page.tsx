"use client";

/**
 * DESIGN EXPLORATION — run-detail-refresh  (DO NOT MERGE / DO NOT SHIP)
 *
 * A single throwaway comparison route that renders 5 differentiated visual
 * variants of the Running Activity Detail surface (`/running/[id]`) side by
 * side, one per idiom from dx/run-detail-refresh.md, so a human can pick a
 * direction at the selection gate. It is PURELY ADDITIVE and flag-gated: it
 * reuses the one standard DX flag (`config.designExploreEnabled`, backed by
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE) and `notFound()`s when unset, so it is
 * dead in production. No production route, component, or data path is touched.
 *
 * All five variants render the SAME static fixture (a Frisco trail run) under a
 * shared scenario + notes control, so a reviewer can compare how each idiom
 * handles the conditional-UI states (no route, no elevation, missing HR, empty
 * vs filled notes). Everything is tokens-only per design-system v0.4.2
 * (in-system scope): the divergence is layout / density / type scale / spacing.
 */

import { useState } from "react";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { SCENARIOS, sessionFor, type ScenarioKey } from "./_fixtures";
import { SessionRecapParity } from "./_variants/SessionRecapParity";
import { MapHeroGarmin } from "./_variants/MapHeroGarmin";
import { StravaOverviewSplit } from "./_variants/StravaOverviewSplit";
import { TracesLabStack } from "./_variants/TracesLabStack";
import { LedgerPlusVoice } from "./_variants/LedgerPlusVoice";

type VariantDef = {
  idiom: string;
  draws: string;
  distinct: string;
  Component: (props: {
    s: ReturnType<typeof sessionFor>;
    notesFilled: boolean;
  }) => React.ReactElement;
};

// Ticket order — one entry per idiom.
const VARIANTS: VariantDef[] = [
  {
    idiom: "session-recap-parity",
    draws:
      "Prog Strength Workout Detail — its date-kicker / big-title / note-as-prose session lead",
    distinct:
      "Workout-parity type scale (4xl title, tiny wide kicker); quiet inline metric line; editorial vertical rhythm with generous gaps.",
    Component: SessionRecapParity,
  },
  {
    idiom: "map-hero-garmin",
    draws: "Garmin Connect — map-first overview compression + a synchronized metric-chart stack",
    distinct:
      "Small dense type; stats compressed onto the map; packed Pace/HR/Elev stack sharing one distance axis.",
    Component: MapHeroGarmin,
  },
  {
    idiom: "strava-overview-split",
    draws: "Strava — the notes-next-to-identity + map pairing and a compact key-stats grid",
    distinct:
      "Two-column overview (identity left, map right); medium social hierarchy; splits as the primary mid-page beat.",
    Component: StravaOverviewSplit,
  },
  {
    idiom: "traces-lab-stack",
    draws: "Garmin charts column + Prog Strength recap styling; Whoop's calm single-accent density",
    distinct:
      "Analysis-first: three equal editorial traces sharing one axis + crosshair; compressed overview; map demoted; tabular axis type.",
    Component: TracesLabStack,
  },
  {
    idiom: "ledger-plus-voice",
    draws: "Runalyze's honest ledger + the shipped Pace-recap language (evolution, not revolution)",
    distinct:
      "Least disruptive: today's rhythm with one inserted overview band; HR/Elev as sibling recaps in the Pace-recap accent treatment.",
    Component: LedgerPlusVoice,
  },
];

export default function RunDetailRefreshDX() {
  if (!config.designExploreEnabled) notFound();

  const [scenario, setScenario] = useState<ScenarioKey>("trail");
  const [notesFilled, setNotesFilled] = useState(true);
  const session = sessionFor(scenario);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* control / legend bar */}
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
                Design Exploration · DO NOT MERGE
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">
                run-detail-refresh — 5 variants
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2 text-xs">
              {VARIANTS.map((v) => (
                <a
                  key={v.idiom}
                  href={`#${v.idiom}`}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  {v.idiom}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ControlGroup label="Scenario">
              {SCENARIOS.map((sc) => (
                <Segment
                  key={sc.key}
                  active={scenario === sc.key}
                  onClick={() => setScenario(sc.key)}
                  title={sc.blurb}
                >
                  {sc.label}
                </Segment>
              ))}
            </ControlGroup>
            <ControlGroup label="Notes">
              <Segment active={notesFilled} onClick={() => setNotesFilled(true)}>
                Filled
              </Segment>
              <Segment active={!notesFilled} onClick={() => setNotesFilled(false)}>
                Empty
              </Segment>
            </ControlGroup>
            <p className="text-xs text-[var(--faint)]">
              Every variant reacts to the shared controls — compare how each idiom handles no-route,
              no-elevation, missing-HR and empty notes.
            </p>
          </div>
        </div>
      </div>

      {/* variants, stacked full-bleed with labelled frames */}
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-10">
        {VARIANTS.map((v, i) => (
          <section key={v.idiom} id={v.idiom} className="scroll-mt-40">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--muted)]">
                {i + 1}/5
              </span>
              <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                {v.idiom}
              </h2>
              <span className="text-xs text-[var(--muted)]">— draws on {v.draws}</span>
            </div>
            <p className="mb-3 max-w-3xl text-xs leading-relaxed text-[var(--faint)]">
              {v.distinct}
            </p>
            <div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-[var(--border-strong)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
              <v.Component s={session} notesFilled={notesFilled} />
            </div>
          </section>
        ))}

        <p className="pb-10 text-center text-xs text-[var(--faint)]">
          Disposable exploration · never merged · the chosen variant is reimplemented by a
          downstream SOW.
        </p>
      </div>
    </main>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </span>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
        {children}
      </div>
    </div>
  );
}

function Segment({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

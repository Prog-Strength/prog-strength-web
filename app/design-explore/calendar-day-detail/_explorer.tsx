"use client";

/**
 * Comparison harness for the calendar-day-detail design exploration.
 * Renders all five idiom variants stacked on one screen, each labeled and
 * anchored, driven by a shared scenario switcher so the same fixture data is
 * compared idiom-to-idiom. THROWAWAY — see the DX ticket; never promoted.
 */

import { useState } from "react";
import { SCENARIOS, type Scenario } from "./_fixtures";
import InboxTriage from "./_variants/inbox-triage";
import TimelineSpine from "./_variants/timeline-spine";
import ItineraryCards from "./_variants/itinerary-cards";
import StatLedDossier from "./_variants/stat-led-dossier";
import SplitLedger from "./_variants/split-ledger";

type VariantDef = {
  idiom: string;
  reference: string;
  one_liner: string;
  Component: (props: { scenario: Scenario }) => React.ReactNode;
};

// Ticket order: inbox-triage, timeline-spine, itinerary-cards, stat-led-dossier, split-ledger.
const VARIANTS: VariantDef[] = [
  {
    idiom: "inbox-triage",
    reference: "Superhuman",
    one_liner: "Dense triage list · focused reader · pinned action row.",
    Component: InboxTriage,
  },
  {
    idiom: "timeline-spine",
    reference: "Fantastical",
    one_liner: "Vertical time axis · blocks placed & sized by their window (clamped).",
    Component: TimelineSpine,
  },
  {
    idiom: "itinerary-cards",
    reference: "Things",
    one_liner: "Calm itinerary cards · roomy spacing · sectioned disclosure pane.",
    Component: ItineraryCards,
  },
  {
    idiom: "stat-led-dossier",
    reference: "Whoop",
    one_liner: "Metric index · pane leads with the numbers, agenda beneath.",
    Component: StatLedDossier,
  },
  {
    idiom: "split-ledger",
    reference: "Linear",
    one_liner: "Borderless hairline ledger · wide type-led reading column.",
    Component: SplitLedger,
  },
];

export default function Explorer() {
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key);
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* harness header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              Design Exploration · calendar-day-detail
            </h1>
            <span className="rounded-full border border-[var(--border-strong)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              DO NOT MERGE · 5 variants · in-system
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Same fixture data across every idiom. Switch the day state to compare how each
            composition holds up.
          </p>

          {/* scenario switcher */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SCENARIOS.map((s) => {
              const active = s.key === scenarioKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScenarioKey(s.key)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 max-w-3xl text-[12px] italic text-[var(--faint)]">{scenario.blurb}</p>
        </div>
      </header>

      {/* stacked variants */}
      <main className="mx-auto max-w-[1400px] space-y-10 px-6 py-8">
        {VARIANTS.map((v, i) => (
          <section key={v.idiom} id={v.idiom} className="scroll-mt-36">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[11px] font-semibold tabular-nums text-[var(--faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                {v.idiom}
              </h2>
              <span className="text-[12px] text-[var(--muted)]">— draws on {v.reference}</span>
              <span className="ml-auto text-[12px] text-[var(--faint)]">{v.one_liner}</span>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]/30">
              {/* key on the scenario remounts the variant so its selection
                  state re-initializes from the new day's events — no effect. */}
              <v.Component key={scenario.key} scenario={scenario} />
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-[12px] text-[var(--muted)]">
          Throwaway exploration on{" "}
          <code className="text-[var(--foreground)]">dx/calendar-day-detail</code>. Pick a direction
          at the selection gate; the winner is reimplemented by a downstream SOW.
        </footer>
      </main>
    </div>
  );
}

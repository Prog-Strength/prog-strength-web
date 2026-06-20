"use client";

/**
 * The MASTER pane of the personal-records ledger+detail layout: a ranked,
 * keyboard-navigable list of rows for the active tab (Lifts or Running).
 *
 * Selection is driven entirely by props (`selectedId` + `onSelect`); the
 * ledger owns NO data fetching. Ranking is delegated to the readiness
 * helpers (`liftsByReadiness` / `runningByReadiness`) so "most due" /
 * "best efforts" order is defined in one place.
 *
 * Each row is a real `<button type="button">`, so keyboard nav (Tab to
 * focus, Enter/Space to activate) comes for free — no custom key handler.
 */

import type { PersonalRecord } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import { formatWeight } from "./format";
import {
  deriveReadiness,
  liftsByReadiness,
  runningByReadiness,
  type RunningLedgerItem,
} from "./readiness";
import type { PRView } from "./ViewSwitcher";

type LedgerState = "pending" | "error" | "ready";

export type PRLedgerProps = {
  view: PRView; // "lifts" | "running"
  lifts?: PersonalRecord[]; // present when view==="lifts"
  running?: RunningLedgerItem[]; // present when view==="running" (all 6 distances, already merged by caller)
  state: LedgerState;
  errorMessage?: string | null;
  selectedId: string | null; // exercise_id (lifts) | distance key (running)
  onSelect: (id: string) => void;
};

/** Uppercase section label that sits above the row list. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] tracking-wide text-[var(--faint)] uppercase">{children}</p>;
}

function LiftRow({
  record,
  selected,
  onSelect,
}: {
  record: PersonalRecord;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const d = deriveReadiness(record);
  const selectable = d.hasPR;

  // Dot color: faint when untested, warning when due, else the lift
  // discipline dot. (The discipline token happens to equal --accent's hex,
  // but we reference the semantic token deliberately.)
  const dotColor = !selectable
    ? "var(--faint)"
    : d.ready
      ? "var(--warning)"
      : "var(--discipline-lift-dot)";

  const stat = `${formatWeight(record.weight, record.unit)}${d.isDumbbell ? " ea" : ""}`;
  const figure =
    record.current_estimated_1rm === null ? "—" : String(Math.round(record.current_estimated_1rm));

  return (
    <li>
      <button
        type="button"
        disabled={!selectable}
        onClick={selectable ? () => onSelect(record.exercise_id) : undefined}
        aria-current={selected ? "true" : undefined}
        aria-label={`${record.exercise_name}, est 1RM ${figure}`}
        className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 px-3 py-2 text-left ${
          selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent"
        } ${selectable ? "" : "opacity-60"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="truncate text-sm">{record.exercise_name}</span>
          <span className="text-[11px] tabular-nums text-[var(--muted)]">{stat}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {d.ready && d.gap !== null ? (
            <span className="text-[var(--warning)] text-sm tabular-nums">+{Math.round(d.gap)}</span>
          ) : null}
          <span className="text-sm tabular-nums">{figure}</span>
        </span>
      </button>
    </li>
  );
}

function RunRow({
  item,
  selected,
  onSelect,
}: {
  item: RunningLedgerItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { formatPace, unitLabel } = useDistanceUnit();
  // 5k is always projectable (the default distance) even when uncovered;
  // other distances are only selectable once the user has a best effort.
  const selectable = item.best !== null || item.key === "5k";

  const dotColor = !selectable ? "var(--faint)" : "var(--discipline-run-dot)";

  const stat = item.best ? `${formatPace(item.best.pace_sec_per_km)}/${unitLabel}` : "—";
  const figure = item.best ? formatDuration(item.best.duration_seconds) : "—";

  // NOTE: no running per-row "PR near" cue. The 1RM/pace projection isn't
  // loaded at ledger time under the lazy-per-selection data model, so the
  // in-reach cue lives in the detail pane, not here. Deliberate omission.

  return (
    <li>
      <button
        type="button"
        disabled={!selectable}
        onClick={selectable ? () => onSelect(item.key) : undefined}
        aria-current={selected ? "true" : undefined}
        aria-label={`${item.label}, best ${figure}`}
        className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 px-3 py-2 text-left ${
          selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent"
        } ${selectable ? "" : "opacity-60"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="truncate text-sm">{item.label}</span>
          <span className="text-[11px] tabular-nums text-[var(--muted)]">{stat}</span>
        </span>
        <span className="text-sm tabular-nums">{figure}</span>
      </button>
    </li>
  );
}

export function PRLedger({
  view,
  lifts = [],
  running = [],
  state,
  errorMessage,
  selectedId,
  onSelect,
}: PRLedgerProps) {
  if (state === "error") {
    return (
      <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
        {errorMessage}
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-10 animate-pulse rounded-md bg-[var(--surface-2)]"
          />
        ))}
      </div>
    );
  }

  if (view === "lifts") {
    if (lifts.length === 0) {
      return <p className="text-sm text-[var(--muted)]">No headline lifts configured.</p>;
    }
    const ranked = liftsByReadiness(lifts);
    return (
      <div>
        <SectionLabel>Most due first</SectionLabel>
        <ul aria-label="Personal records" className="space-y-0.5">
          {ranked.map((record) => (
            <LiftRow
              key={record.exercise_id}
              record={record}
              selected={record.exercise_id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </div>
    );
  }

  const ranked = runningByReadiness(running);
  return (
    <div>
      <SectionLabel>Best efforts</SectionLabel>
      <ul aria-label="Personal records" className="space-y-0.5">
        {ranked.map((item) => (
          <RunRow
            key={item.key}
            item={item}
            selected={item.key === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

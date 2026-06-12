"use client";

/**
 * Sibling table views of the same window of data: per-workout 1RM
 * estimates (the points feeding the chart) and the raw sets logged in
 * those workouts. The view toggle, filter pills, and filtered-exercise
 * state are shared so switching feels like flipping a tab on one table.
 *
 * A caption between the header and the filter pills ties the estimates
 * table's "% of current capability" column back to the chart's Y-axis —
 * the two surfaces produce identical numbers (`normalized_max`); the
 * caption makes that connection visible.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { ExerciseBaseline, MuscleGroupProgressionPoint, Workout } from "@/lib/api";
import { COLOR_DEFAULT } from "./shared";
import { EstimatesTable } from "./EstimatesTable";
import { SetsTable, buildSetsRows } from "./SetsTable";

type TableView = "estimates" | "sets";

export function TablesSection({
  points,
  workouts,
  exerciseBaselines,
  exerciseColors,
}: {
  points: MuscleGroupProgressionPoint[];
  workouts: Workout[];
  exerciseBaselines: ExerciseBaseline[];
  exerciseColors: Map<string, string>;
}) {
  const [view, setView] = useState<TableView>("estimates");
  // `null` = no filter, show every exercise. Shared across views so
  // toggling preserves what the lifter is looking at.
  const [filterExerciseID, setFilterExerciseID] = useState<string | null>(null);

  const baselineByID = useMemo(() => {
    const m = new Map<string, ExerciseBaseline>();
    for (const b of exerciseBaselines) m.set(b.exercise_id, b);
    return m;
  }, [exerciseBaselines]);

  // Estimates rows — most recent first, that's how lifters read a log.
  const estimateRows = useMemo(() => {
    const filtered = filterExerciseID
      ? points.filter((p) => p.exercise_id === filterExerciseID)
      : points;
    return [...filtered].sort(
      (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
    );
  }, [points, filterExerciseID]);

  const setsRows = useMemo(() => buildSetsRows(workouts, baselineByID), [workouts, baselineByID]);
  const filteredSetsRows = useMemo(
    () =>
      filterExerciseID ? setsRows.filter((r) => r.exercise_id === filterExerciseID) : setsRows,
    [setsRows, filterExerciseID],
  );

  // Per-exercise counts for the filter pills — each view counts its own
  // notion of a "row" so the pill counts always match what the user sees.
  const estimateCountByExercise = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) m.set(p.exercise_id, (m.get(p.exercise_id) ?? 0) + 1);
    return m;
  }, [points]);
  const setsCountByExercise = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of setsRows) m.set(r.exercise_id, (m.get(r.exercise_id) ?? 0) + 1);
    return m;
  }, [setsRows]);
  const activeCountByExercise =
    view === "estimates" ? estimateCountByExercise : setsCountByExercise;
  const activeTotal = view === "estimates" ? points.length : setsRows.length;

  const meta =
    view === "estimates"
      ? {
          title: "Per-workout 1RM estimates",
          description:
            "Each row is one workout's data on this exercise, expressed as an estimated one-rep max — the points feeding the chart above.",
        }
      : {
          title: "Sets, reps, weight",
          description:
            "Raw sets logged in this window. Sets with matching reps and weight inside the same workout are grouped into one row.",
        };

  // The caption names the exercise in focus when a single one is filtered,
  // else the literal word "exercise" (the All-pattern / no-single case).
  const focusedExerciseName =
    (filterExerciseID
      ? baselineByID.get(filterExerciseID)?.exercise_name
      : exerciseBaselines.length === 1
        ? exerciseBaselines[0].exercise_name
        : undefined) ?? "exercise";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight">{meta.title}</h2>
          <p className="text-xs text-[var(--muted)]">{meta.description}</p>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {view === "estimates" && (
        <p className="mb-3 text-xs text-[var(--muted)]">
          Same metric as the chart — each row&apos;s % is how that workout&apos;s heaviest set
          compared to your current {focusedExerciseName} baseline.
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterPill active={filterExerciseID === null} onClick={() => setFilterExerciseID(null)}>
          All ({activeTotal})
        </FilterPill>
        {exerciseBaselines.map((b) => {
          const count = activeCountByExercise.get(b.exercise_id) ?? 0;
          return (
            <FilterPill
              key={b.exercise_id}
              active={filterExerciseID === b.exercise_id}
              onClick={() => setFilterExerciseID(b.exercise_id)}
              color={exerciseColors.get(b.exercise_id) ?? COLOR_DEFAULT}
            >
              {b.exercise_name} ({count})
            </FilterPill>
          );
        })}
      </div>

      {view === "estimates" ? (
        <EstimatesTable rows={estimateRows} exerciseColors={exerciseColors} />
      ) : (
        <SetsTable rows={filteredSetsRows} exerciseColors={exerciseColors} />
      )}
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: TableView; onChange: (v: TableView) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Table view"
      className="inline-flex shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs"
    >
      <ViewToggleButton active={value === "estimates"} onClick={() => onChange("estimates")}>
        1RM estimates
      </ViewToggleButton>
      <ViewToggleButton active={value === "sets"} onClick={() => onChange("sets")}>
        Sets × Reps × Weight
      </ViewToggleButton>
    </div>
  );
}

function ViewToggleButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-medium transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  children,
  active,
  onClick,
  color,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {color !== undefined && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}

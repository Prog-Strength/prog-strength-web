"use client";

import { useState } from "react";

import type { Exercise, PersonalRecordEvent, WorkoutExercise, WorkoutSet } from "@/lib/api";
import { fmtWeight, topSetIndex } from "@/lib/workout-recap";

/**
 * Detail-page-specific quiet exercise list for the session-recap layout.
 *
 * Deliberately NOT the shared `WorkoutDetailsBody` — that component still
 * serves the Workouts list, the Calendar digest, and the Timeline card, and is
 * left untouched. The recap demotes the exercises to a supporting cast: one
 * scannable line per standalone exercise (or per superset block), showing the
 * name, the set count, and the reconstructed top set rather than a stack of
 * per-set bullets. Each exercise line gains a chevron that expands to its
 * actual sets (`reps × weight`, the PR set client-matched and marked); each
 * group keeps an edit pencil wired to the page's existing `ExerciseEditModal`
 * handler, revealed on hover/focus. The chevron and the pencil are distinct
 * affordances — the pencil edits, the chevron reveals sets.
 */
export function RecapExerciseList({
  exercises,
  exerciseMap,
  personalRecords,
  onEditGroup,
}: {
  exercises: WorkoutExercise[];
  exerciseMap: Map<string, Exercise>;
  personalRecords: PersonalRecordEvent[];
  onEditGroup: (group: WorkoutExercise[], groupIndex: number) => void;
}) {
  const groups = groupExercises(exercises);
  // Expanded state keyed per exercise line ("<groupIndex>:<indexInGroup>") so
  // each exercise within a superset expands independently.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ul className="flex flex-col">
      {groups.map((group, gIdx) => {
        const isSuperset = group.length > 1;
        return (
          <li
            key={gIdx}
            className="group flex items-start justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              {/* One tag for the whole block — a superset reads as a single
                  unit, not a tag repeated on every line. */}
              {isSuperset && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  superset
                </span>
              )}
              {group.map((we, i) => {
                const catalogEntry = exerciseMap.get(we.exercise_id);
                const name = catalogEntry?.name ?? we.exercise_id;
                const key = `${gIdx}:${i}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} sets for ${name}`}
                        className="shrink-0 rounded text-[var(--faint)] transition hover:text-[var(--foreground)]"
                      >
                        <ChevronIcon open={isOpen} />
                      </button>
                      <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
                        {name}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--muted)]">
                        {topSetReadout(we, catalogEntry)}
                      </span>
                    </div>
                    {isOpen && (
                      <SetList
                        exercise={we}
                        catalogEntry={catalogEntry}
                        personalRecords={personalRecords}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onEditGroup(group, gIdx)}
              aria-label={isSuperset ? "Edit superset" : "Edit exercise"}
              className="shrink-0 rounded p-1 text-[var(--faint)] opacity-0 transition focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-[var(--foreground)]"
            >
              <PencilIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The expanded per-set detail for one exercise: one row per set in order,
 * `reps × weight` (bodyweight reads its reps; per-dumbbell appends the
 * clarifier). The PR set is marked 🏆 in `--warning` — see `prSetIndex`.
 */
function SetList({
  exercise,
  catalogEntry,
  personalRecords,
}: {
  exercise: WorkoutExercise;
  catalogEntry: Exercise | undefined;
  personalRecords: PersonalRecordEvent[];
}) {
  const perDumbbell = isPerDumbbell(catalogEntry);
  const prIndex = prSetIndex(exercise, personalRecords);
  return (
    <ul className="ml-5 flex flex-col gap-1">
      {exercise.sets.map((s, i) => (
        <li key={i} className="flex items-baseline gap-2 text-xs tabular-nums text-[var(--muted)]">
          <span className="w-4 shrink-0 text-right text-[var(--faint)]">{i + 1}</span>
          <span>{setReadout(s, perDumbbell)}</span>
          {i === prIndex && <span className="text-[var(--warning)]">🏆</span>}
        </li>
      ))}
    </ul>
  );
}

/** One set's `reps × weight`, or `reps reps` for a bodyweight (non-positive) set. */
function setReadout(s: WorkoutSet, perDumbbell: boolean): string {
  if (s.weight <= 0) return `${s.reps} reps`;
  const suffix = perDumbbell ? " per dumbbell" : "";
  return `${s.reps} × ${fmtWeight(s.weight, s.unit)}${suffix}`;
}

/**
 * Index of the set to mark as the PR, or -1 if none. A `PersonalRecordEvent`
 * carries no pointer to the `WorkoutSet` that broke it, so this is a client
 * match by weight AND reps AND unit against this exercise's PR events. When
 * several sets tie the PR, the top set (`topSetIndex`) takes precedence;
 * otherwise the first matching set. No match marks nothing — the honest
 * "couldn't match" behavior rather than guessing.
 */
function prSetIndex(exercise: WorkoutExercise, personalRecords: PersonalRecordEvent[]): number {
  const prs = personalRecords.filter((pr) => pr.exercise_id === exercise.exercise_id);
  if (prs.length === 0) return -1;
  const matches = (s: WorkoutSet) =>
    prs.some((pr) => pr.weight === s.weight && pr.reps === s.reps && pr.unit === s.unit);
  const top = topSetIndex(exercise);
  if (exercise.sets[top] && matches(exercise.sets[top])) return top;
  return exercise.sets.findIndex(matches);
}

/**
 * The supporting set readout for one exercise: the set count and its top set
 * (the heaviest, reconstructed by `topSetIndex` since there is no warm-up
 * flag). Bodyweight sets (non-positive weight) read out their reps instead of
 * a load. Per-dumbbell exercises append the clarifier so a single-hand figure
 * is never read as the combined pair.
 */
function topSetReadout(exercise: WorkoutExercise, catalogEntry: Exercise | undefined): string {
  const { sets } = exercise;
  if (sets.length === 0) return "0 sets";
  const top = sets[topSetIndex(exercise)];
  const count = `${sets.length} ×`;
  if (top.weight <= 0) {
    return `${count} · top ${top.reps} reps`;
  }
  const suffix = isPerDumbbell(catalogEntry) ? " per dumbbell" : "";
  return `${count} · top ${fmtWeight(top.weight, top.unit)}${suffix}`;
}

/**
 * Walk exercises in `order` and bucket consecutive entries sharing a non-null
 * `superset_group` into one render group. Standalone exercises start their own
 * single-element group. Mirrors the adjacency rule the shared body uses so the
 * two surfaces group supersets identically; kept local because the recap list
 * is intentionally separate from `WorkoutDetailsBody`.
 */
function groupExercises(exercises: WorkoutExercise[]): WorkoutExercise[][] {
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const groups: WorkoutExercise[][] = [];
  for (const ex of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastEx = lastGroup?.[lastGroup.length - 1];
    if (lastEx && ex.superset_group != null && lastEx.superset_group === ex.superset_group) {
      lastGroup.push(ex);
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}

/**
 * Whether the recorded weight is per-implement (bilateral dumbbell exercises)
 * rather than the combined load. Same signal the shared body reads: the
 * exercise must use a dumbbell and its catalog description carries the
 * "per dumbbell" convention (unilateral DB lifts deliberately omit it).
 */
function isPerDumbbell(ex: Exercise | undefined): boolean {
  if (!ex) return false;
  if (!ex.equipment?.includes("dumbbell")) return false;
  return (ex.description ?? "").toLowerCase().includes("per dumbbell");
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

import type { Exercise, PlannedExercise, PlannedSet } from "@/lib/api";
import { MuscleGroupPill } from "@/components/muscle-group-pill";

/**
 * Read-only, timeline-style rendering of a planned lift agenda — the
 * planned-workout analogue of {@link WorkoutDetailsBody}. Numbered
 * exercises with muscle pills and grouped target-set lines, so a glance at
 * a planned session reads the same way a logged one does ("5 reps × 3 sets
 * @ 135 lbs"). Planned workouts have no supersets, so each exercise is its
 * own numbered block.
 *
 * Targets are forward-looking: weight is optional (omitted from the line
 * when unset — the user may fill it in while lifting), and an optional RPE
 * target is appended.
 */
export function PlannedAgendaDetails({
  exercises,
  exerciseMap,
}: {
  exercises: PlannedExercise[];
  exerciseMap: Map<string, Exercise>;
}) {
  const ordered = [...exercises].sort((a, b) => a.order_index - b.order_index);
  return (
    <ul className="flex flex-col gap-3">
      {ordered.map((ex, idx) => {
        const catalogEntry = exerciseMap.get(ex.exercise_id);
        const setLines = formatPlannedSets(ex.sets);
        const muscleGroups = catalogEntry?.muscle_groups ?? [];
        return (
          <li key={ex.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">
                {idx + 1}. {catalogEntry?.name ?? ex.exercise_id}
              </p>
              {muscleGroups.map((mg) => (
                <MuscleGroupPill key={mg} muscleGroup={mg} />
              ))}
            </div>
            {setLines.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--muted)] marker:text-[var(--muted)]">
                {setLines.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            )}
            {ex.notes && <p className="mt-1 text-xs italic text-[var(--muted)]">{ex.notes}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One human-readable line per *group* of identical target sets, collapsing
 * a run of matching reps×weight×unit×rpe the way the logged-workout
 * formatter does: three identical 5×135 sets become "5 reps × 3 sets @ 135
 * lbs" rather than three bullets.
 *
 * Weight is optional on a plan — when unset the `@ weight` clause is
 * dropped (the line is just reps × sets). An optional RPE target is
 * appended as "· RPE 8". Sorted by order_index first so the lines read in
 * the intended sequence.
 */
export function formatPlannedSets(sets: PlannedSet[]): string[] {
  if (sets.length === 0) return [];
  const ordered = [...sets].sort((a, b) => a.order_index - b.order_index);
  const groups: { count: number; set: PlannedSet }[] = [];
  for (const s of ordered) {
    const last = groups[groups.length - 1];
    if (last && plannedSetsEqual(last.set, s)) {
      last.count += 1;
    } else {
      groups.push({ count: 1, set: s });
    }
  }

  return groups.map((g) => {
    const setsPart = `${g.count} ${pluralize("set", g.count)}`;
    let line = g.set.amrap
      ? `AMRAP × ${setsPart}`
      : g.set.target_reps != null
        ? `${g.set.target_reps} ${pluralize("rep", g.set.target_reps)} × ${setsPart}`
        : setsPart;
    if (g.set.target_weight != null) {
      line += ` @ ${formatWeight(g.set.target_weight)} ${displayUnit(g.set.unit ?? "lb")}`;
    }
    if (g.set.target_rpe != null) {
      line += ` · RPE ${formatWeight(g.set.target_rpe)}`;
    }
    return line;
  });
}

function plannedSetsEqual(a: PlannedSet, b: PlannedSet): boolean {
  return (
    a.amrap === b.amrap &&
    a.target_reps === b.target_reps &&
    a.target_weight === b.target_weight &&
    a.unit === b.unit &&
    a.target_rpe === b.target_rpe
  );
}

function formatWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

function displayUnit(unit: "lb" | "kg"): string {
  return unit === "lb" ? "lbs" : "kg";
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

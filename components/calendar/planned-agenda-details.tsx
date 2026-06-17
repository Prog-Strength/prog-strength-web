import type { Exercise, PlannedExercise, PlannedSet } from "@/lib/api";
import { MuscleGroupPill } from "@/components/muscle-group-pill";

/**
 * Read-only, timeline-style rendering of a planned lift agenda — the
 * planned-workout analogue of {@link WorkoutDetailsBody}. Numbered
 * exercises with muscle pills and grouped target-set lines, so a glance at
 * a planned session reads the same way a logged one does ("5 reps × 3 sets
 * @ 135 lbs").
 *
 * Targets are forward-looking: weight is optional (omitted from the line
 * when unset — the user may fill it in while lifting), and an optional RPE
 * target is appended.
 *
 * Two presentations, selected by `variant`:
 *  - **default** — the standalone planned-workout page. Saturated
 *    {@link MuscleGroupPill} chips, and a flat numbered list (supersets are
 *    not visually grouped here, so that page reads exactly as it always has).
 *  - **calendar** — the calendar's planned-workout modal. Restrained slate
 *    muscle chips that sit quietly inside the compact slate panel, and
 *    consecutive exercises sharing a non-null `superset_group` bound under a
 *    violet accent-line rail with a "superset" tag.
 */
export function PlannedAgendaDetails({
  exercises,
  exerciseMap,
  variant = "default",
}: {
  exercises: PlannedExercise[];
  exerciseMap: Map<string, Exercise>;
  variant?: "default" | "calendar";
}) {
  const ordered = [...exercises].sort((a, b) => a.order_index - b.order_index);

  // Keep numbering tied to the flat order, so a superset's members stay
  // "3.", "4." etc. regardless of how they're visually grouped.
  const renderExercise = (ex: PlannedExercise, idx: number) => {
    const catalogEntry = exerciseMap.get(ex.exercise_id);
    const setLines = formatPlannedSets(ex.sets);
    const muscleGroups = catalogEntry?.muscle_groups ?? [];
    return (
      <li key={ex.id}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            {idx + 1}. {catalogEntry?.name ?? ex.exercise_id}
          </p>
          {muscleGroups.map((mg) =>
            variant === "calendar" ? (
              <SlateMuscleChip key={mg} muscleGroup={mg} />
            ) : (
              <MuscleGroupPill key={mg} muscleGroup={mg} />
            ),
          )}
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
  };

  // The default page stays a flat numbered list (no superset grouping).
  if (variant !== "calendar") {
    return <ul className="flex flex-col gap-3">{ordered.map(renderExercise)}</ul>;
  }

  // Calendar variant: bind consecutive same-group exercises (runs of 2+)
  // under a violet accent rail; everything else renders as a plain item.
  const runs = groupConsecutiveSupersets(ordered);
  return (
    <ul className="flex flex-col gap-3">
      {runs.map((run) =>
        run.group != null && run.indices.length > 1 ? (
          <li key={`g-${run.group}`} className="border-l-2 border-[var(--accent-line)] pl-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              Superset
            </p>
            <ul className="flex flex-col gap-3">
              {run.indices.map((i) => renderExercise(ordered[i], i))}
            </ul>
          </li>
        ) : (
          renderExercise(ordered[run.indices[0]], run.indices[0])
        ),
      )}
    </ul>
  );
}

/**
 * Restrained, slate-tinted muscle chip for the calendar variant — drops the
 * saturated per-muscle hues of {@link MuscleGroupPill} for a quiet chip that
 * sits inside the compact slate modal panel. Mirrors the pill's display text.
 */
function SlateMuscleChip({ muscleGroup }: { muscleGroup: string }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      {humanizeMuscleGroup(muscleGroup)}
    </span>
  );
}

/**
 * Group ordered exercises into consecutive render runs: a run of 2+ sharing a
 * non-null `superset_group` is a superset; everything else is a singleton run
 * (group null). Each run carries indices into the `ordered` array. Mirrors
 * `groupRuns` in the agenda editor.
 */
function groupConsecutiveSupersets(
  ordered: PlannedExercise[],
): { group: number | null; indices: number[] }[] {
  const runs: { group: number | null; indices: number[] }[] = [];
  ordered.forEach((ex, i) => {
    const last = runs[runs.length - 1];
    if (last && ex.superset_group != null && last.group === ex.superset_group) {
      last.indices.push(i);
    } else {
      runs.push({ group: ex.superset_group, indices: [i] });
    }
  });
  return runs;
}

/**
 * Display form for a muscle-group slug (capitalize, split on underscores).
 * Local to the calendar's slate chip; {@link MuscleGroupPill} keeps its own.
 */
function humanizeMuscleGroup(mg: string): string {
  return mg
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
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

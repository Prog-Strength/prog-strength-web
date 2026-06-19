/**
 * Client-side derivations for the Workout Detail session-recap layout.
 *
 * The recap tells a logged session as a short story: an editorial headline
 * (the top PR break, or the session's title when there were no PRs), a
 * celebratory PR subhead, and the heaviest "top set" of each exercise read
 * out beside it. None of this is in the API payload — a PersonalRecordEvent
 * carries no pointer to the WorkoutSet that set it and sets have no warm-up
 * flag — so every figure here is reconstructed from the workout itself.
 *
 * Pure functions, no fetching: the page hands in the loaded workout, the
 * exercise catalog map (for lift names), and the catalog list (for the muscle
 * tally). Shared muscle math lives in lib/muscle-set-distribution.
 */

import type { Exercise, PersonalRecordEvent, Workout, WorkoutExercise } from "@/lib/api";
import { hasMeaningfulName } from "@/components/workout-details";
import { setsByCategory, type CategorySetCount } from "@/lib/muscle-set-distribution";

// Spelled-out counts for the headline ("Four PRs, …"); numerals above the
// list fall back to digits.
const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** Long-form session date — the recap kicker and the no-name title fallback. */
export function formatRecapDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Drop the leading equipment/stance word from a lift name so the headline
 * reads as plain prose ("Bench Press", not "Barbell Bench Press"). Mirrors the
 * dx/workout-detail mockup's shortLift.
 */
export function shortLift(name: string): string {
  return name.replace(/^(?:Barbell|Dumbbell|Seated|Standing|Lying) /, "");
}

/**
 * Display name for a workout, falling back to the date when the name is the
 * API's auto-generated "Workout - <date>" placeholder. Defers to the shared
 * `hasMeaningfulName` so the recap, the workouts list, and the calendar all
 * apply the same rule.
 */
export function workoutTitle(workout: Workout): string {
  return hasMeaningfulName(workout.name) ? workout.name : formatRecapDate(workout.performed_at);
}

/** Round to one decimal, strip a trailing ".0", and append the unit. */
export function fmtWeight(value: number, unit: string | null): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${text} ${unit}` : text;
}

/** The heaviest break (ties broken by reps) — the headline's subject. */
function topPr(events: PersonalRecordEvent[]): PersonalRecordEvent {
  return events.reduce((best, e) =>
    e.weight > best.weight || (e.weight === best.weight && e.reps > best.reps) ? e : best,
  );
}

/**
 * The editorial lead: a date kicker and a headline that says what happened
 * before any number. With PRs the headline names the top break ("Four PRs,
 * topped by 305 lb × 2 on Bench Press", singular "A new PR — …"); with none it
 * falls back to the workout title (and thence the date for auto-named sessions),
 * so a note-less, PR-less session still reads complete.
 */
export function leadHeadline(
  workout: Workout,
  exerciseMap: Map<string, Exercise>,
): { kicker: string; headline: string } {
  const kicker = formatRecapDate(workout.performed_at);
  const prs = workout.personal_records_set;
  if (prs.length === 0) {
    return { kicker, headline: workoutTitle(workout) };
  }
  const top = topPr(prs);
  const lift = shortLift(exerciseMap.get(top.exercise_id)?.name ?? top.exercise_id);
  const n = prs.length;
  const word = NUMBER_WORDS[n] ?? String(n);
  const Word = word.charAt(0).toUpperCase() + word.slice(1);
  const headline =
    n === 1
      ? `A new PR — ${fmtWeight(top.weight, top.unit)} × ${top.reps} on ${lift}`
      : `${Word} PRs, topped by ${fmtWeight(top.weight, top.unit)} × ${top.reps} on ${lift}`;
  return { kicker, headline };
}

/**
 * The celebratory subhead under the headline: the break count and the top one
 * or two breaks as `weight × reps`. Rendered only when PRs exist.
 */
export function prSubhead(events: PersonalRecordEvent[]): string {
  const n = events.length;
  const top = [...events]
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)
    .slice(0, 2)
    .map((p) => `${fmtWeight(p.weight, p.unit)} × ${p.reps}`)
    .join(" and ");
  return `${n} new personal ${n === 1 ? "record" : "records"} — including ${top}.`;
}

/**
 * Index of an exercise's "top set": the heaviest load, ties broken by reps.
 * This is how the warm-up ramp is distinguished from the working/top set
 * without a warm-up flag the data doesn't carry; it degrades for a flat scheme
 * by returning the first of equal-weight sets.
 */
export function topSetIndex(exercise: WorkoutExercise): number {
  let best = 0;
  for (let i = 1; i < exercise.sets.length; i++) {
    const s = exercise.sets[i];
    const b = exercise.sets[best];
    if (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best = i;
  }
  return best;
}

/**
 * The "what it trained" strip: the populated tail of the shared per-category
 * set tally, largest first. Reuses `setsByCategory` (the same aggregation the
 * removed radar/bars drew) so no muscle math is re-derived; the zeros are
 * dropped rather than rendered as a degenerate near-empty chart.
 */
export function populatedCategories(workout: Workout, exercises: Exercise[]): CategorySetCount[] {
  return setsByCategory([workout], exercises)
    .data.filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

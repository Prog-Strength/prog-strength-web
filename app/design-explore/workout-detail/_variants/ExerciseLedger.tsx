"use client";

/**
 * IDIOM: exercise-ledger — Draws on the Strong / Hevy workout log.
 *
 * The exercise list is the HERO, rebuilt so each lift expresses its set
 * structure: the warm-up ramp is dimmed apart from the working/top set, each
 * exercise carries a top-set + volume readout, and the PR set is marked inline
 * (🏆 on the 305 × 2 row, matched client-side). Supersets read as one bracketed
 * block. The redundant radar+bars collapse to one compact muscle strip in a
 * demoted header.
 *
 * Distinct on:
 *  - TYPE SCALE: uniform fine tabular set rows — no hero number; hierarchy
 *    comes from ALIGNMENT and weight-of-ink, not size.
 *  - COLOR LOGIC: color-as-state only — warm-up rows --faint, the working/top
 *    set in lift steel-blue, the PR row in --warning. Nothing decorative.
 *  - SPACING RHYTHM: dense, tabular, even row rhythm (the densest of the five).
 *
 * Degrades: a flat 3×5 has no ramp ⇒ every row reads as a working set (no
 * misleading warm-up dimming).
 */

import type { Workout, WorkoutExercise, WorkoutSet } from "@/lib/api";
import {
  exerciseMuscle,
  exerciseName,
  exerciseVolume,
  fmtDate,
  fmtDuration,
  fmtVolume,
  fmtWeight,
  hasRamp,
  isDumbbell,
  populatedMuscles,
  prForSet,
  setCount,
  setVolume,
  topSetIndex,
  workoutTitle,
  workoutVolume,
  type WorkoutFixture,
} from "../_fixtures";
import { Back, Pencil, Plus, Trophy } from "../_icons";

type SetRole = "warmup" | "working" | "top";

function roleOf(ex: WorkoutExercise, idx: number): SetRole {
  const topIdx = topSetIndex(ex);
  if (!hasRamp(ex)) return "working"; // flat scheme: nothing is a "warm-up"
  if (idx === topIdx) return "top";
  const topWeight = ex.sets[topIdx].weight;
  return ex.sets[idx].weight >= topWeight ? "working" : "warmup";
}

function SetRow({
  s,
  role,
  index,
  isPR,
}: {
  s: WorkoutSet;
  role: SetRole;
  index: number;
  isPR: boolean;
}) {
  const weightTone = role === "warmup" ? "text-[var(--faint)]" : "text-[var(--discipline-lift-fg)]";
  return (
    <div
      className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 px-3 py-1.5 text-[13px] tabular-nums ${
        isPR ? "bg-[var(--warning)]/[0.07]" : ""
      }`}
    >
      <span className="text-right text-[var(--faint)]">{index + 1}</span>
      <span className={role === "warmup" ? "text-[var(--faint)]" : "text-[var(--muted)]"}>
        {role === "warmup" ? "warm-up" : role === "top" ? "top set" : "working"}
      </span>
      <span className={`text-right font-medium ${weightTone}`}>
        {s.reps} × {fmtWeight(s.weight, s.unit)}
      </span>
      <span className="flex w-16 items-center justify-end gap-1 text-right text-[var(--faint)]">
        {isPR ? (
          <span className="flex items-center gap-1 text-[var(--warning)]">
            <Trophy size={12} /> PR
          </span>
        ) : (
          setVolume(s).toLocaleString("en-US")
        )}
      </span>
    </div>
  );
}

function ExerciseBlock({ exes, workout }: { exes: WorkoutExercise[]; workout: Workout }) {
  const isSuperset = exes.length > 1;
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] ${
        isSuperset ? "border-l-2 border-l-[var(--accent-line)]" : ""
      }`}
    >
      {isSuperset && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Superset
        </div>
      )}
      {exes.map((ex, ei) => {
        const top = ex.sets[topSetIndex(ex)];
        return (
          <div key={ex.exercise_id} className={ei > 0 ? "border-t border-[var(--border)]" : ""}>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
                    {exerciseName(ex.exercise_id)}
                  </h3>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {exerciseMuscle(ex.exercise_id)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] tabular-nums text-[var(--muted)]">
                <span>
                  top{" "}
                  <span className="text-[var(--discipline-lift-fg)]">
                    {fmtWeight(top.weight, top.unit)}
                    {isDumbbell(ex.exercise_id) && "/h"}
                  </span>
                </span>
                <span className="text-[var(--faint)]">·</span>
                <span>{exerciseVolume(ex).toLocaleString("en-US")} vol</span>
                <button className="text-[var(--faint)] transition hover:text-[var(--foreground)]">
                  <Pencil size={13} />
                </button>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pb-1.5 pt-1">
              {/* column legend */}
              <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-3 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--faint)]">
                <span className="text-right">#</span>
                <span>type</span>
                <span className="text-right">reps × wt</span>
                <span className="w-16 text-right">vol</span>
              </div>
              {ex.sets.map((s, si) => (
                <SetRow
                  key={si}
                  s={s}
                  index={si}
                  role={roleOf(ex, si)}
                  isPR={Boolean(prForSet(workout, ex.exercise_id, s))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExerciseLedger({ fixture }: { fixture: WorkoutFixture }) {
  const { workout: w, muscle } = fixture;
  const duration = fmtDuration(w.performed_at, w.ended_at);
  const trained = populatedMuscles(muscle);
  const prCount = w.personal_records_set.length;

  // group exercises by superset_group, preserving order
  const groups: WorkoutExercise[][] = [];
  for (const ex of w.exercises) {
    const prev = groups[groups.length - 1];
    if (ex.superset_group != null && prev && prev[0].superset_group === ex.superset_group) {
      prev.push(ex);
    } else {
      groups.push([ex]);
    }
  }

  const stats: [string, string][] = [
    ["Vol", fmtVolume(workoutVolume(w))],
    ["Sets", String(setCount(w))],
    ["Exercises", String(w.exercises.length)],
    ...(duration ? [["Time", duration] as [string, string]] : []),
    ...(prCount ? [["PRs", String(prCount)] as [string, string]] : []),
  ];

  return (
    <article className="bg-[var(--background)]">
      {/* demoted header: title + inline stats + one-line muscle strip */}
      <header className="border-b border-[var(--border)] px-6 py-4">
        <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <Back size={13} /> Workouts
        </button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">{workoutTitle(w)}</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {fmtDate(w.performed_at)}
              {duration && ` · ${duration}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]">
              Edit details
            </button>
            <button className="rounded-md border border-[var(--danger)]/35 px-2.5 py-1 text-[var(--danger)] transition hover:bg-[var(--danger)]/10">
              Delete
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {stats.map(([label, value]) => (
            <span key={label} className="tabular-nums text-[var(--muted)]">
              <span className="text-[var(--foreground)]">{value}</span>{" "}
              <span className="text-[var(--faint)]">{label}</span>
            </span>
          ))}
          <span className="text-[var(--faint)]">|</span>
          {trained.map((m) => (
            <span key={m.category} className="tabular-nums text-[var(--faint)]">
              {m.category} {m.sets}
            </span>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-6 py-5">
        {groups.map((g, i) => (
          <ExerciseBlock key={i} exes={g} workout={w} />
        ))}
        <button className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] py-2.5 text-xs text-[var(--accent)] transition hover:bg-[var(--surface)]">
          <Plus size={13} /> Add exercise
        </button>
      </div>
    </article>
  );
}

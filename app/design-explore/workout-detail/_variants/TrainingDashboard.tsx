"use client";

/**
 * IDIOM: training-dashboard — Draws on the Whoop overview grid.
 *
 * Leans INTO the dashboard but makes it earn it: the redundant two-chart muscle
 * panel collapses to ONE consolidated visualization (sets-by-muscle bars, the
 * degenerate radar killed), promoted as the hero beside the KPI tiles; the
 * exercise list demotes to a dense scannable table that scales to a 12-exercise
 * day.
 *
 * Distinct on:
 *  - TYPE SCALE: small functional type throughout — KPI numbers are the only
 *    emphasis; everything else is metadata-sized.
 *  - COLOR LOGIC: status-encoded — steel-blue marks the top set / the bars,
 *    --warning flags PR cells, --success the deltas. One consolidated chart,
 *    never the same numbers twice.
 *  - SPACING RHYTHM: very tight, gridded, even — a control surface, not a page.
 *
 * Degrades: only-one-category data renders as a single honest bar, never a
 * lopsided radar sliver.
 */

import type { Workout } from "@/lib/api";
import {
  exerciseMuscle,
  exerciseName,
  exerciseVolume,
  fmtDate,
  fmtDuration,
  fmtVolume,
  fmtWeight,
  populatedMuscles,
  setCount,
  topSetIndex,
  workoutTitle,
  workoutVolume,
  type WorkoutFixture,
} from "../_fixtures";
import { Back, Pencil, Plus, Trophy } from "../_icons";

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
          accent ? "text-[var(--warning)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MuscleBars({ workout, muscle }: { workout: Workout; muscle: WorkoutFixture["muscle"] }) {
  const data = populatedMuscles(muscle);
  const max = Math.max(...data.map((d) => d.sets), 1);
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Sets by muscle
        </h3>
        <span className="text-[10px] text-[var(--faint)]">
          {data.length} of 6 trained · {setCount(workout)} sets
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {data.map((d) => (
          <div key={d.category} className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 text-right text-[11px] text-[var(--muted)]">
              {d.category}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--discipline-lift-dot)]"
                style={{ width: `${(d.sets / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-[var(--foreground)]">
              {d.sets}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrainingDashboard({ fixture }: { fixture: WorkoutFixture }) {
  const { workout: w, muscle } = fixture;
  const duration = fmtDuration(w.performed_at, w.ended_at);
  const prCount = w.personal_records_set.length;

  // flatten exercises into table rows, tagging superset membership
  const rows = w.exercises.map((ex, i, arr) => {
    const inSuperset = ex.superset_group != null;
    const supersetLead = inSuperset && (i === 0 || arr[i - 1].superset_group !== ex.superset_group);
    const top = ex.sets[topSetIndex(ex)];
    const hasPR = w.personal_records_set.some((p) => p.exercise_id === ex.exercise_id);
    return { ex, inSuperset, supersetLead, top, hasPR };
  });

  return (
    <article className="bg-[var(--background)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3.5">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
            <Back size={13} /> Workouts
          </button>
          <div className="h-4 w-px bg-[var(--border-strong)]" />
          <div>
            <h1 className="text-sm font-semibold tracking-tight">{workoutTitle(w)}</h1>
            <p className="text-[11px] text-[var(--muted)]">
              {fmtDate(w.performed_at)}
              {duration && ` · ${duration}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]">
            Edit details
          </button>
          <button className="rounded-md border border-[var(--danger)]/35 px-2.5 py-1 text-[var(--danger)] transition hover:bg-[var(--danger)]/10">
            Delete
          </button>
        </div>
      </header>

      <div className="space-y-3 px-6 py-5">
        {/* hero grid: KPI column + consolidated chart */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
            <Kpi label="Volume" value={fmtVolume(workoutVolume(w))} />
            <Kpi label="Sets" value={String(setCount(w))} />
            <Kpi label="Exercises" value={String(w.exercises.length)} />
            {duration && <Kpi label="Duration" value={duration} />}
            {prCount > 0 && <Kpi label="PRs" value={String(prCount)} accent />}
          </div>
          <MuscleBars workout={w} muscle={muscle} />
        </div>

        {/* dense exercise table */}
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Exercises
            </h3>
            <button className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline">
              <Plus size={11} /> Add
            </button>
          </div>
          {/* header row */}
          <div className="grid grid-cols-[2rem_1fr_5rem_4rem_5rem_2rem] gap-2 border-b border-[var(--border)] px-4 py-1.5 text-[10px] uppercase tracking-wide text-[var(--faint)]">
            <span>#</span>
            <span>Exercise</span>
            <span className="text-right">Sets</span>
            <span className="text-right">Top</span>
            <span className="text-right">Vol</span>
            <span />
          </div>
          {rows.map(({ ex, inSuperset, supersetLead, top, hasPR }, i) => (
            <div
              key={ex.exercise_id}
              className={`group grid grid-cols-[2rem_1fr_5rem_4rem_5rem_2rem] items-center gap-2 px-4 py-2 text-xs tabular-nums ${
                i > 0 ? "border-t border-[var(--border)]" : ""
              } ${inSuperset ? "border-l-2 border-l-[var(--accent-line)]" : ""}`}
            >
              <span className="text-[var(--faint)]">{ex.order}</span>
              <div className="min-w-0">
                {supersetLead && (
                  <span className="mr-1.5 rounded bg-[var(--accent-soft)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--accent)]">
                    SS
                  </span>
                )}
                <span className="text-[var(--foreground)]">{exerciseName(ex.exercise_id)}</span>
                <span className="ml-1.5 text-[10px] text-[var(--faint)]">
                  {exerciseMuscle(ex.exercise_id)}
                </span>
              </div>
              <span className="text-right text-[var(--muted)]">{ex.sets.length}</span>
              <span className="text-right text-[var(--discipline-lift-fg)]">
                {fmtWeight(top.weight, null)}×{top.reps}
              </span>
              <span className="flex items-center justify-end gap-1 text-right text-[var(--muted)]">
                {hasPR && <Trophy size={11} className="text-[var(--warning)]" />}
                {exerciseVolume(ex).toLocaleString("en-US")}
              </span>
              <button className="justify-self-end text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--foreground)]">
                <Pencil size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

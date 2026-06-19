"use client";

/**
 * IDIOM: pr-celebration — Draws on the Apple Fitness award moment / Strava
 * achievements.
 *
 * The PRs ARE the page. The trophy moment is promoted to a hero: each PR is a
 * confident block with the lift, the weight × reps, and the `up from` delta
 * shown LARGE (245 → 305, +60) — and each is tied back to the exact set that
 * earned it (its place in the ramp). Summary, analytics and the full exercise
 * list demote beneath.
 *
 * Distinct on:
 *  - TYPE SCALE: mid scale with one oversized number per PR (the weight), the
 *    delta a confident secondary figure — celebratory, not editorial prose.
 *  - COLOR LOGIC: --warning carries the celebration budget (trophy + card
 *    wash), --success carries the deltas, the lift steel-blue marks the set in
 *    the ramp. The accent stays app-chrome only.
 *  - SPACING RHYTHM: generous hero cards up top, then a tight supporting strip.
 *
 * Degrades: zero PRs ⇒ a calm "solid session" summary hero (no trophies, no
 * collapse) — proving the page stands without a celebration.
 */

import type { PersonalRecordEvent, Workout } from "@/lib/api";
import {
  exerciseMuscle,
  exerciseName,
  fmtDate,
  fmtDuration,
  fmtVolume,
  fmtWeight,
  isDumbbell,
  matchPRSet,
  populatedMuscles,
  setCount,
  topSetIndex,
  workoutTitle,
  workoutVolume,
  type WorkoutFixture,
} from "../_fixtures";
import { Back, Pencil, Plus, Trophy } from "../_icons";

function rampLabel(w: Workout, ev: PersonalRecordEvent): string | null {
  const match = matchPRSet(w, ev);
  if (!match) return null;
  const { exercise, setIndex } = match;
  const n = exercise.sets.length;
  const first = exercise.sets[0];
  const isTop = setIndex === topSetIndex(exercise);
  const place = isTop ? "top set" : `set ${setIndex + 1}`;
  return `${place} · ${setIndex + 1} of ${n} · ramped from ${fmtWeight(first.weight, first.unit)}`;
}

function PrCard({ ev, workout }: { ev: PersonalRecordEvent; workout: Workout }) {
  const name = exerciseName(ev.exercise_id);
  const ramp = rampLabel(workout, ev);
  const delta = ev.previous_weight != null ? ev.weight - ev.previous_weight : null;
  const firstEver = ev.previous_weight == null;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--warning)]/30 bg-[var(--warning)]/[0.06] p-5">
      <div className="flex items-center gap-2 text-[var(--warning)]">
        <Trophy size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
          {firstEver ? "First ever" : "New PR"}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-medium text-[var(--foreground)]">{name}</h3>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-5xl font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
          {fmtWeight(ev.weight, null)}
        </span>
        <span className="pb-1 text-base text-[var(--muted)]">{ev.unit}</span>
        <span className="pb-1 text-lg tabular-nums text-[var(--muted)]">× {ev.reps}</span>
        {isDumbbell(ev.exercise_id) && (
          <span className="pb-1.5 text-[10px] uppercase tracking-wide text-[var(--faint)]">
            / hand
          </span>
        )}
      </div>

      {/* the delta — the "earned it" line */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        {firstEver ? (
          <span className="text-[var(--muted)]">First logged set on this lift</span>
        ) : (
          <>
            <span className="tabular-nums text-[var(--muted)]">
              {fmtWeight(ev.previous_weight!, ev.previous_unit)}
            </span>
            <span className="text-[var(--faint)]">→</span>
            <span className="tabular-nums text-[var(--foreground)]">
              {fmtWeight(ev.weight, ev.unit)}
            </span>
            <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--success)]">
              +{delta}
            </span>
          </>
        )}
      </div>

      {/* tied back to the set that set it */}
      {ramp && (
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs tabular-nums text-[var(--discipline-lift-fg)]">
          {ramp}
        </p>
      )}
    </div>
  );
}

export function PrCelebration({ fixture }: { fixture: WorkoutFixture }) {
  const { workout: w, muscle } = fixture;
  const prs = [...w.personal_records_set].sort((a, b) => b.weight - a.weight);
  const duration = fmtDuration(w.performed_at, w.ended_at);
  const trained = populatedMuscles(muscle);

  const tiles: [string, string][] = [
    ["Volume", fmtVolume(workoutVolume(w))],
    ["Sets", String(setCount(w))],
    ["Exercises", String(w.exercises.length)],
    ...(duration ? [["Duration", duration] as [string, string]] : []),
  ];

  return (
    <article className="bg-[var(--background)]">
      <header className="border-b border-[var(--border)] px-8 py-5">
        <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <Back size={13} /> Workouts
        </button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{workoutTitle(w)}</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {fmtDate(w.performed_at)}
              {duration && ` · ${duration}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--muted)] transition hover:text-[var(--foreground)]">
              Edit details
            </button>
            <button className="rounded-md border border-[var(--danger)]/35 px-3 py-1.5 text-[var(--danger)] transition hover:bg-[var(--danger)]/10">
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-8">
        {prs.length > 0 ? (
          <>
            {/* hero — the trophy moment */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
                <Trophy size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  {prs.length} new personal {prs.length === 1 ? "record" : "records"}
                </h2>
                <p className="text-sm text-[var(--muted)]">This session moved the needle.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {prs.map((ev) => (
                <PrCard key={ev.id} ev={ev} workout={w} />
              ))}
            </div>
          </>
        ) : (
          // degrade: no trophies, still a confident session header
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-sm text-[var(--muted)]">No PRs this time —</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Solid session in the books.
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {fmtVolume(workoutVolume(w))} across {setCount(w)} sets. Consistency is the PR that
              compounds.
            </p>
          </div>
        )}

        {/* supporting strip — demoted */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div
              key={label}
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* single muscle strip */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs">
          <span className="uppercase tracking-wide text-[var(--faint)]">Trained</span>
          {trained.map((m) => (
            <span
              key={m.category}
              className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 tabular-nums text-[var(--muted)]"
            >
              {m.category} {m.sets}
            </span>
          ))}
        </div>

        {/* exercise list — demoted, compact */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Exercises</h3>
            <button className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              <Plus size={12} /> Add exercise
            </button>
          </div>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
            {w.exercises.map((g, i, arr) => {
              const supersetLead =
                g.superset_group != null &&
                (i === 0 || arr[i - 1].superset_group !== g.superset_group);
              const inSuperset = g.superset_group != null;
              const hasPR = w.personal_records_set.some((p) => p.exercise_id === g.exercise_id);
              const top = g.sets[topSetIndex(g)];
              return (
                <div
                  key={g.exercise_id}
                  className={`group flex items-center justify-between gap-3 px-4 py-3 ${
                    inSuperset ? "border-l-2 border-[var(--accent-line)]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    {supersetLead && (
                      <p className="text-[10px] uppercase tracking-wide text-[var(--accent)]">
                        Superset
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-[var(--foreground)]">
                        {exerciseName(g.exercise_id)}
                      </span>
                      {hasPR && <Trophy size={12} className="shrink-0 text-[var(--warning)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--faint)]">
                      {exerciseMuscle(g.exercise_id)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-[var(--muted)]">
                      {g.sets.length} sets · top {fmtWeight(top.weight, top.unit)}
                    </span>
                    <button className="text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--foreground)]">
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </article>
  );
}

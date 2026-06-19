"use client";

/**
 * SHARED, NON-DIVERGENT scaffolding for the workout-detail-refinements DX.
 *
 * The ticket is explicit: the five variants differ on ONE thing — the graphic
 * that replaces the "What it trained" strip. Everything else (the session-recap
 * structure and the new expand-to-sets affordance) is held IDENTICAL across
 * variants so the comparison isolates the graphic. So those identical pieces
 * live here, once, and each variant injects only its graphic:
 *
 *   - <RecapShell>            — Header, Lead, Reflection, Stat line, a graphic
 *                              slot, and The Work. A `placement` prop lets a
 *                              variant drop its graphic where the strip was
 *                              ("block") or beside the stat line ("aside").
 *   - <ExpandableExerciseList> — the shared accordion: the calm collapsed
 *                              top-set readout stays the default; each exercise
 *                              expands to its exact sets, the PR set marked in
 *                              --warning. Works across supersets, bodyweight,
 *                              and per-dumbbell lifts.
 *
 * The stat line carries a reserved (not rendered) home for the planned lift-TCX
 * data — see <ReservedTcxHome>. It is identical in every variant, so it never
 * affects the graphic comparison; it only demonstrates the layout leaves room.
 *
 * NOTE: this is shared because the ticket MANDATES these pieces be identical —
 * it is not the divergent axis. The divergence lives entirely in _variants/*.
 */

import { useState, type ReactNode } from "react";
import type { Exercise, Workout, WorkoutExercise } from "@/lib/api";
import {
  CATALOG,
  exerciseName,
  fmtDate,
  fmtDuration,
  fmtVolume,
  fmtWeight,
  isPerDumbbell,
  prForSet,
  setCount,
  topSetIndex,
  workoutTitle,
  workoutVolume,
  type WorkoutFixture,
} from "./_fixtures";

// === Recap shell ==========================================================

type Placement = "block" | "aside";

export function RecapShell({
  fixture,
  graphicLabel = "What it trained",
  graphic,
  placement = "block",
}: {
  fixture: WorkoutFixture;
  graphicLabel?: string;
  graphic: ReactNode;
  placement?: Placement;
}) {
  const { workout } = fixture;
  const hasPrs = workout.personal_records_set.length > 0;
  const top = hasPrs ? topPr(workout) : null;

  return (
    <div className="bg-[var(--background)]">
      {/* Header — ← Workouts, subtitle, Edit details + Delete. Unchanged. */}
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <span className="text-xs text-[var(--muted)]">← Workouts</span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">{headerSubtitle(workout)}</p>
          <div className="flex shrink-0 gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
              Edit details
            </span>
            <span className="rounded-full border border-[var(--danger)]/35 px-3 py-1 text-xs text-[var(--danger)]">
              Delete
            </span>
          </div>
        </div>
      </header>

      <div className="px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <article className="space-y-10">
            {/* Lead — date kicker + PR headline + --warning PR subhead. */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
                {fmtDate(workout.performed_at)}
              </p>
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
                {top
                  ? `A new PR — ${fmtWeight(top.weight, top.unit)} × ${top.reps} on ${shortLift(
                      exerciseName(top.exercise_id),
                    )}`
                  : workoutTitle(workout)}
              </h1>
              {hasPrs && (
                <p className="text-base font-medium text-[var(--warning)]">
                  {workout.personal_records_set.length} new personal{" "}
                  {workout.personal_records_set.length === 1 ? "record" : "records"} this session.
                </p>
              )}
            </div>

            {/* Reflection — the note as prose, or a quiet placeholder. */}
            {workout.notes && workout.notes.trim() ? (
              <p className="whitespace-pre-wrap text-lg leading-[1.7] text-[var(--foreground)]">
                {workout.notes}
              </p>
            ) : (
              <p className="text-base italic leading-relaxed text-[var(--faint)]">
                No reflection on this session.
              </p>
            )}

            {/* Stat line + graphic. In "aside" placement the graphic sits beside
                the stats in a two-column grid; in "block" it takes the strip's
                old full-width slot just below. */}
            {placement === "aside" ? (
              <div className="grid gap-6 border-y border-[var(--border)] py-6 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <StatLine workout={workout} />
                  <ReservedTcxHome />
                </div>
                <GraphicFrame label={graphicLabel}>{graphic}</GraphicFrame>
              </div>
            ) : (
              <>
                <div className="border-y border-[var(--border)] py-5">
                  <StatLine workout={workout} />
                  <ReservedTcxHome />
                </div>
                <GraphicFrame label={graphicLabel}>{graphic}</GraphicFrame>
              </>
            )}

            {/* The Work — gains the shared expand-to-sets. */}
            <section className="space-y-1">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
                  The work
                </p>
                <span className="text-xs text-[var(--accent)]">+ Add exercise</span>
              </div>
              <ExpandableExerciseList workout={workout} />
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}

/** Wraps a variant's graphic with the quiet section label the strip carried. */
function GraphicFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * The quiet stat line — Volume · Sets · Exercises · Duration · PRs, with honest
 * tile-dropping (no Duration without ended_at, no PRs at zero).
 */
function StatLine({ workout }: { workout: Workout }) {
  const duration = fmtDuration(workout.performed_at, workout.ended_at);
  const prCount = workout.personal_records_set.length;

  const stats: [string, string][] = [
    ["Volume", fmtVolume(workoutVolume(workout))],
    ["Sets", String(setCount(workout))],
    ["Exercises", String(workout.exercises.length)],
  ];
  if (duration) stats.push(["Duration", duration]);
  if (prCount > 0) stats.push(["PRs", String(prCount)]);

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-4">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * RESERVED, not rendered: the planned lift-TCX upload will add Avg HR · Max HR ·
 * Calories tiles (and an HR-over-time trace). The ticket asks each layout to
 * leave them a home so the future feature drops in without a redo. We render a
 * single faint dashed ghost — a design annotation, NOT fabricated data — so the
 * reviewer can see the stat line has room to grow. Identical in every variant.
 */
function ReservedTcxHome() {
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">Reserved</span>
      <span className="text-[11px] text-[var(--faint)]">
        Avg HR · Max HR · Calories — when a TCX is attached
      </span>
    </div>
  );
}

// === Expandable exercise list (shared addition) ===========================

/**
 * The shared expand-to-sets affordance. Default is the calm collapsed readout
 * (set count + reconstructed top set). Each row expands to its exact sets
 * (`set · reps × weight`), with the top set / client-matched PR row marked in
 * --warning. Supersets render as one bound block (accent-line left bar);
 * bodyweight sets read reps not a load; per-dumbbell appends the clarifier.
 */
export function ExpandableExerciseList({ workout }: { workout: Workout }) {
  const groups = groupExercises(workout.exercises);
  return (
    <ul className="flex flex-col">
      {groups.map((group, gIdx) => {
        const isSuperset = group.length > 1;
        return (
          <li
            key={gIdx}
            className={`border-b border-[var(--border)] py-2.5 last:border-0 ${
              isSuperset ? "border-l-2 border-l-[var(--accent-line)] pl-3" : ""
            }`}
          >
            {isSuperset && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                superset
              </span>
            )}
            <div className="flex flex-col gap-1">
              {group.map((we, i) => (
                <ExerciseRow key={i} workout={workout} we={we} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ExerciseRow({ workout, we }: { workout: Workout; we: WorkoutExercise }) {
  const [open, setOpen] = useState(false);
  const ex = lookupExercise(we.exercise_id);
  const topIdx = topSetIndex(we);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-baseline justify-between gap-4 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <Chevron open={open} />
          <span className="truncate text-sm text-[var(--foreground)]">
            {ex?.name ?? we.exercise_id}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
          {collapsedReadout(we)}
        </span>
      </button>

      {open && (
        <ol className="mt-2 mb-1 ml-5 flex flex-col gap-1 border-l border-[var(--border)] pl-4">
          {we.sets.map((s, i) => {
            const pr = prForSet(workout, we.exercise_id, s);
            const isTop = i === topIdx;
            return (
              <li
                key={i}
                className={`flex items-baseline justify-between gap-3 text-xs tabular-nums ${
                  pr
                    ? "text-[var(--warning)]"
                    : isTop
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                }`}
              >
                <span className="text-[var(--faint)]">Set {i + 1}</span>
                <span className="flex items-center gap-1.5">
                  {setReadout(we, s)}
                  {pr && <span aria-label="personal record">🏆</span>}
                  {isTop && !pr && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
                      top
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// === local helpers ========================================================

function collapsedReadout(we: WorkoutExercise): string {
  if (we.sets.length === 0) return "0 sets";
  const top = we.sets[topSetIndex(we)];
  const count = `${we.sets.length} ×`;
  if (top.weight <= 0) return `${count} · top ${top.reps} reps`;
  const suffix = isPerDumbbell(we.exercise_id) ? " per dumbbell" : "";
  return `${count} · top ${fmtWeight(top.weight, top.unit)}${suffix}`;
}

function setReadout(
  we: WorkoutExercise,
  s: { reps: number; weight: number; unit: string },
): string {
  if (s.weight <= 0) return `${s.reps} reps`;
  const suffix = isPerDumbbell(we.exercise_id) ? " per dumbbell" : "";
  return `${s.reps} × ${fmtWeight(s.weight, s.unit)}${suffix}`;
}

function lookupExercise(id: string): Exercise | undefined {
  return CATALOG.get(id);
}

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

function topPr(workout: Workout) {
  return workout.personal_records_set.reduce((best, e) =>
    e.weight > best.weight || (e.weight === best.weight && e.reps > best.reps) ? e : best,
  );
}

function shortLift(name: string): string {
  return name.replace(/^(?:Barbell|Dumbbell|Machine|Seated|Standing|Lying|Cable) /, "");
}

function headerSubtitle(workout: Workout): string {
  const duration = fmtDuration(workout.performed_at, workout.ended_at);
  return [workout.name, fmtDate(workout.performed_at), duration]
    .filter((p): p is string => Boolean(p))
    .join(" · ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 text-[var(--faint)] transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

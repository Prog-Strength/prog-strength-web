"use client";

/**
 * IDIOM: session-timeline — Draws on the Strava activity timeline / laps.
 *
 * The session AS IT HAPPENED in time. Exercises (and supersets) lay out on a
 * vertical time spine, each anchored to a clock offset derived from the 1h 20m
 * duration; sets read set-by-set; PR breaks light up as warm beats at the
 * moment they occurred; and the skipped-abs note drops inline where it belongs
 * in the flow. Duration becomes structural — the page answers *when*, not just
 * *what*.
 *
 * Distinct on:
 *  - TYPE SCALE: medium feed type, even down the spine — time labels and set
 *    lines share one rhythm; no single hero number.
 *  - COLOR LOGIC: driven by event — a PR beat glows --warning on the spine,
 *    the rest of the spine is calm --border/--muted. Steel-blue marks the set.
 *  - SPACING RHYTHM: chronological flow, each node a beat down a single rail.
 *
 * Degrades: no `ended_at` ⇒ no clock anchors; the spine becomes a plain ordered
 * flow ("set 1 → set N") rather than a fake timeline.
 */

import type { ReactNode } from "react";
import type { Workout, WorkoutExercise } from "@/lib/api";
import {
  exerciseMuscle,
  exerciseName,
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtWeight,
  prForSet,
  topSetIndex,
  workoutTitle,
  type WorkoutFixture,
} from "../_fixtures";
import { Back, Clock, Pencil, Plus, Trophy } from "../_icons";

// Group exercises into superset blocks, preserving order.
function groupExercises(w: Workout): WorkoutExercise[][] {
  const groups: WorkoutExercise[][] = [];
  for (const ex of w.exercises) {
    const prev = groups[groups.length - 1];
    if (ex.superset_group != null && prev && prev[0].superset_group === ex.superset_group) {
      prev.push(ex);
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}

function Node({
  children,
  beat,
  glow,
  time,
}: {
  children: ReactNode;
  beat?: ReactNode;
  glow?: boolean;
  time?: string | null;
}) {
  return (
    <div className="relative grid grid-cols-[3.25rem_1.5rem_1fr] gap-2">
      {/* clock column */}
      <div className="pt-1 text-right text-[11px] tabular-nums text-[var(--faint)]">
        {time ?? ""}
      </div>
      {/* spine + dot column */}
      <div className="relative flex justify-center">
        <span className="absolute top-0 h-full w-px bg-[var(--border-strong)]" />
        <span
          className={`relative mt-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
            glow
              ? "border-[var(--warning)] bg-[var(--warning)]/20 ring-2 ring-[var(--warning)]/15"
              : "border-[var(--border-strong)] bg-[var(--surface-2)]"
          }`}
        >
          {beat}
        </span>
      </div>
      {/* content column */}
      <div className="pb-5">{children}</div>
    </div>
  );
}

export function SessionTimeline({ fixture }: { fixture: WorkoutFixture }) {
  const { workout: w } = fixture;
  const groups = groupExercises(w);
  const duration = fmtDuration(w.performed_at, w.ended_at);
  const timed = Boolean(w.ended_at);
  const startMs = new Date(w.performed_at).getTime();
  const totalMs = w.ended_at ? new Date(w.ended_at).getTime() - startMs : 0;

  // clock anchor for the i-th block, spread across the duration
  const anchor = (i: number): string | null => {
    if (!timed) return null;
    const frac = groups.length > 1 ? i / groups.length : 0;
    return fmtClock(new Date(startMs + frac * totalMs).toISOString());
  };

  return (
    <article className="bg-[var(--background)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <Back size={13} /> Workouts
        </button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{workoutTitle(w)}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              {fmtDate(w.performed_at)}
              {duration && (
                <>
                  <span className="text-[var(--faint)]">·</span>
                  <Clock size={12} /> {duration}
                </>
              )}
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

      <div className="mx-auto max-w-2xl px-6 py-6">
        {/* start beat */}
        <Node time={timed ? fmtClock(w.performed_at) : "start"}>
          <p className="pt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {timed ? "Session started" : "Session (in progress)"}
          </p>
        </Node>

        {groups.map((group, gi) => {
          const isSuperset = group.length > 1;
          const groupHasPR = group.some((ex) =>
            ex.sets.some((s) => prForSet(w, ex.exercise_id, s)),
          );
          return (
            <Node
              key={gi}
              time={anchor(gi)}
              glow={groupHasPR}
              beat={
                groupHasPR ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                ) : undefined
              }
            >
              <div
                className={`group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 ${
                  isSuperset ? "border-l-2 border-l-[var(--accent-line)]" : ""
                }`}
              >
                {isSuperset && (
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Superset
                  </p>
                )}
                {group.map((ex, ei) => {
                  const topIdx = topSetIndex(ex);
                  return (
                    <div
                      key={ex.exercise_id}
                      className={ei > 0 ? "mt-3 border-t border-[var(--border)] pt-3" : ""}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                            {exerciseName(ex.exercise_id)}
                          </h3>
                          <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
                            {exerciseMuscle(ex.exercise_id)}
                          </span>
                        </div>
                        <button className="text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--foreground)]">
                          <Pencil size={13} />
                        </button>
                      </div>
                      {/* sets read set-by-set, the way they happened */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ex.sets.map((s, si) => {
                          const pr = prForSet(w, ex.exercise_id, s);
                          const isTop = si === topIdx;
                          return (
                            <span
                              key={si}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs tabular-nums ${
                                pr
                                  ? "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--warning)]"
                                  : isTop
                                    ? "border-[var(--discipline-lift-dot)]/30 bg-[var(--discipline-lift-bg)] text-[var(--discipline-lift-fg)]"
                                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                              }`}
                            >
                              {pr && <Trophy size={11} />}
                              {s.reps}×{fmtWeight(s.weight, null)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Node>
          );
        })}

        {/* the note dropped inline, late in the flow where it belongs */}
        {w.notes && w.notes.trim() && (
          <Node time={anchor(groups.length)}>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
                Reflection
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                {w.notes}
              </p>
            </div>
          </Node>
        )}

        {/* finish beat */}
        <div className="grid grid-cols-[3.25rem_1.5rem_1fr] gap-2">
          <div className="pt-1 text-right text-[11px] tabular-nums text-[var(--faint)]">
            {w.ended_at ? fmtClock(w.ended_at) : ""}
          </div>
          <div className="flex justify-center">
            <span className="mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--border-strong)] bg-[var(--background)]" />
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {w.ended_at ? `Finished · ${duration}` : "Not yet finished"}
            </p>
            <button className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              <Plus size={12} /> Add exercise
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

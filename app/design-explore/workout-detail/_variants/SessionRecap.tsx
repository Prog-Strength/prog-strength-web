"use client";

/**
 * IDIOM: session-recap — Draws on The Athletic recap / the Oura day card.
 *
 * Tells the session as a short STORY. The note is promoted to the lead (an
 * editorial headline + the reflection set as readable prose), the PRs ride as
 * a celebratory subhead, and the numbers + exercises support quietly beneath.
 *
 * Distinct on:
 *  - TYPE SCALE: one large editorial headline (text-4xl) against small caption
 *    furniture and relaxed body prose — the widest type contrast of the five.
 *  - COLOR LOGIC: near-monochrome; --warning is spent ONLY on the PR subhead.
 *    No steel-blue structure tint, no chart color.
 *  - SPACING RHYTHM: airy reading-document column (max-w-prose, space-y-10),
 *    the opposite of a dense dashboard.
 *
 * Degrades: no note ⇒ the lead becomes a plain session verdict + date, so a
 * note-less session still reads complete rather than broken.
 */

import type { Workout } from "@/lib/api";
import {
  exerciseName,
  fmtClock,
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
import { Back, Pencil, Plus } from "../_icons";

function shortLift(name: string): string {
  return name.replace(/^Barbell |^Dumbbell |^Seated |^Standing |^Lying /g, "");
}

// The editorial lead: a headline that says what happened before any number.
function lead(w: Workout): { kicker: string; headline: string } {
  const prs = w.personal_records_set;
  const date = fmtDate(w.performed_at);
  if (prs.length === 0) {
    return { kicker: date, headline: workoutTitle(w) };
  }
  const top = [...prs].sort((a, b) => b.weight - a.weight)[0];
  const lift = shortLift(exerciseName(top.exercise_id));
  const n = prs.length;
  const word = ["zero", "one", "two", "three", "four", "five", "six"][n] ?? String(n);
  const headline =
    n === 1
      ? `A new PR — ${fmtWeight(top.weight, top.unit)} × ${top.reps} on ${lift}`
      : `${word[0].toUpperCase()}${word.slice(1)} PRs, topped by ${fmtWeight(top.weight, top.unit)} × ${top.reps} on ${lift}`;
  return { kicker: date, headline };
}

export function SessionRecap({ fixture }: { fixture: WorkoutFixture }) {
  const { workout: w, muscle } = fixture;
  const { kicker, headline } = lead(w);
  const prs = w.personal_records_set;
  const duration = fmtDuration(w.performed_at, w.ended_at);
  const trained = populatedMuscles(muscle);
  const hasNote = Boolean(w.notes && w.notes.trim());

  return (
    <article className="bg-[var(--background)]">
      {/* header — back, title, edit affordances */}
      <header className="border-b border-[var(--border)] px-8 py-5">
        <button className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <Back size={13} /> Workouts
        </button>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="text-xs text-[var(--muted)]">
            {workoutTitle(w)} · {fmtDate(w.performed_at)}
            {duration && ` · ${duration}`}
          </div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]">
              Edit details
            </button>
            <button className="rounded-full border border-[var(--danger)]/35 px-3 py-1 text-[var(--danger)] transition hover:bg-[var(--danger)]/10">
              Delete
            </button>
          </div>
        </div>
      </header>

      {/* editorial body — a centered reading column */}
      <div className="mx-auto max-w-2xl space-y-10 px-8 py-12">
        {/* lead */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            {kicker}
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
            {headline}
          </h1>
          {prs.length > 0 && (
            <p className="text-base font-medium text-[var(--warning)]">
              {prs.length} new personal {prs.length === 1 ? "record" : "records"}
              {" — including "}
              {[...prs]
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 2)
                .map((p) => `${fmtWeight(p.weight, p.unit)} × ${p.reps}`)
                .join(" and ")}
              .
            </p>
          )}
        </div>

        {/* the reflection, as the body of the story */}
        {hasNote ? (
          <p className="whitespace-pre-wrap text-lg leading-[1.7] text-[var(--foreground)]">
            {w.notes}
          </p>
        ) : (
          <p className="text-base italic leading-relaxed text-[var(--faint)]">
            No reflection on this session.
          </p>
        )}

        {/* a quiet stat line — numbers support, they don't lead */}
        <dl className="flex flex-wrap gap-x-10 gap-y-4 border-y border-[var(--border)] py-5">
          {[
            ["Volume", fmtVolume(workoutVolume(w))],
            ["Sets", String(setCount(w))],
            ["Exercises", String(w.exercises.length)],
            ...(duration ? [["Duration", duration] as [string, string]] : []),
            ...(prs.length ? [["PRs", String(prs.length)] as [string, string]] : []),
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/* muscle analytics collapsed to a single quiet strip */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            What it trained
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
            {trained.map((m, i) => (
              <span key={m.category}>
                <span className="text-[var(--foreground)]">{m.category}</span>
                <span className="text-[var(--faint)]"> {m.sets}</span>
                {i < trained.length - 1 && <span className="px-1.5 text-[var(--faint)]">·</span>}
              </span>
            ))}
          </div>
        </div>

        {/* exercises — supporting cast, quiet list */}
        <section className="space-y-1">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              The work
            </p>
            <button className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              <Plus size={12} /> Add exercise
            </button>
          </div>
          {w.exercises.map((groupHead, i, arr) => {
            // collapse supersets into one line group
            if (
              groupHead.superset_group != null &&
              i > 0 &&
              arr[i - 1].superset_group === groupHead.superset_group
            ) {
              return null;
            }
            const group =
              groupHead.superset_group != null
                ? arr.filter((e) => e.superset_group === groupHead.superset_group)
                : [groupHead];
            return (
              <div
                key={groupHead.exercise_id}
                className="group flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  {group.map((g) => {
                    const top = g.sets[topSetIndex(g)];
                    return (
                      <div key={g.exercise_id} className="flex items-baseline gap-2">
                        <span className="truncate text-sm text-[var(--foreground)]">
                          {exerciseName(g.exercise_id)}
                        </span>
                        {group.length > 1 && (
                          <span className="text-[10px] uppercase tracking-wide text-[var(--accent)]">
                            superset
                          </span>
                        )}
                        <span className="text-xs tabular-nums text-[var(--muted)]">
                          {g.sets.length} × · top {fmtWeight(top.weight, top.unit)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--foreground)]">
                  <Pencil size={13} />
                </button>
              </div>
            );
          })}
        </section>

        <p className="pt-2 text-right text-[10px] text-[var(--faint)]">
          logged {fmtClock(w.performed_at)}
        </p>
      </div>
    </article>
  );
}

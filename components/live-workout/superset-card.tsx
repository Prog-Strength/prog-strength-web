"use client";

/**
 * A grouped superset card: the members sharing one `superset_group`,
 * logged a round at a time. Shows each member with its already-logged
 * sets (editable) and a "next round" draft row; "Log round" appends one
 * set per member via `logSupersetRound` then starts the rest timer.
 * Members may end with differing set counts (a partial last round) —
 * that's expected and fine.
 *
 * The next-round draft lives in local state seeded from each member's
 * last set; on log it's flushed through the provider and re-seeded.
 */

import { useState } from "react";
import type { Exercise } from "@/lib/api";
import { defaultSet, type DraftExercise, type DraftSet } from "@/lib/workout-draft";
import { SetHeaderRow, SetRow, inputClasses } from "@/components/live-workout/set-row";

/** Member of a superset paired with its index in the session's exercise array. */
export type SupersetMember = { index: number; exercise: DraftExercise };

function seedRound(members: SupersetMember[]): Record<number, DraftSet> {
  const seed: Record<number, DraftSet> = {};
  for (const m of members) {
    const last = m.exercise.sets[m.exercise.sets.length - 1];
    seed[m.index] = last ? { ...last } : defaultSet("lb");
  }
  return seed;
}

export function SupersetCard({
  members,
  catalog,
  onLogRound,
  onUngroup,
  onUpdateSet,
  onRemoveSet,
}: {
  members: SupersetMember[];
  catalog: Map<string, Exercise>;
  onLogRound: (sets: Record<number, DraftSet>) => void;
  onUngroup: () => void;
  onUpdateSet: (exIdx: number, setIdx: number, patch: Partial<DraftSet>) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
}) {
  // Draft of the next round, keyed by the member's exercise index.
  const [round, setRound] = useState<Record<number, DraftSet>>(() => seedRound(members));

  // Current round number = the most sets any member has logged, + 1 for
  // the round being entered.
  const loggedRounds = members.reduce((max, m) => Math.max(max, m.exercise.sets.length), 0);

  const updateRound = (exIdx: number, patch: Partial<DraftSet>) =>
    setRound((r) => ({ ...r, [exIdx]: { ...(r[exIdx] ?? defaultSet("lb")), ...patch } }));

  const logRound = () => {
    onLogRound(round);
    // Re-seed from what we just logged so the next round defaults to it.
    setRound((r) => {
      const next: Record<number, DraftSet> = {};
      for (const m of members) next[m.index] = { ...(r[m.index] ?? defaultSet("lb")) };
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--accent)]/50 bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            Superset
          </span>
          <span className="text-xs text-[var(--muted)]">
            {loggedRounds} {loggedRounds === 1 ? "round" : "rounds"} logged
          </span>
        </div>
        <button
          type="button"
          onClick={onUngroup}
          className="text-xs text-[var(--muted)] transition hover:text-[var(--danger)]"
        >
          Ungroup
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {members.map((m) => {
          const name =
            catalog.get(m.exercise.exercise_id)?.name ?? `${m.exercise.exercise_id} (unknown)`;
          return (
            <div
              key={m.index}
              className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] p-2"
            >
              <h4 className="truncate text-sm font-medium">{name}</h4>
              {m.exercise.sets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SetHeaderRow />
                  {m.exercise.sets.map((s, setIdx) => (
                    <SetRow
                      key={setIdx}
                      index={setIdx}
                      set={s}
                      onChange={(patch) => onUpdateSet(m.index, setIdx, patch)}
                      onRemove={() => onRemoveSet(m.index, setIdx)}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Next
                </span>
                <input
                  type="number"
                  min={1}
                  value={round[m.index]?.reps ?? 0}
                  onChange={(e) =>
                    updateRound(m.index, { reps: parseInt(e.target.value, 10) || 0 })
                  }
                  className={`${inputClasses} flex-1`}
                  aria-label={`${name} next round reps`}
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={round[m.index]?.weight ?? 0}
                  onChange={(e) =>
                    updateRound(m.index, { weight: parseFloat(e.target.value) || 0 })
                  }
                  className={`${inputClasses} flex-1`}
                  aria-label={`${name} next round weight`}
                />
                <select
                  value={round[m.index]?.unit ?? "lb"}
                  onChange={(e) => updateRound(m.index, { unit: e.target.value as "lb" | "kg" })}
                  className={inputClasses}
                  aria-label={`${name} next round unit`}
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={logRound}
        className="self-start rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
      >
        Log round {loggedRounds + 1}
      </button>
    </div>
  );
}

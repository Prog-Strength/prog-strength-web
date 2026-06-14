"use client";

/**
 * Type-to-add exercise picker for the live session. Filters the catalog
 * client-side by name (and muscle group / equipment, like the Exercises
 * page) and, on selecting a result, calls `onAdd(exercise_id)` and clears
 * the query. The provider seeds the new exercise's first set from
 * last-time prefill, so the caller only needs the slug.
 *
 * The pure `filterExercises` helper is exported for unit tests.
 */

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/api";

/** Case-insensitive match on name + muscle groups + equipment. */
export function filterExercises(catalog: Exercise[], query: string): Exercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog
    .filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      if (e.muscle_groups.some((mg) => mg.toLowerCase().includes(q))) return true;
      if (e.equipment.some((eq) => eq.toLowerCase().includes(q))) return true;
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ExerciseSearch({
  catalog,
  onAdd,
}: {
  catalog: Exercise[];
  onAdd: (exerciseId: string) => void;
}) {
  const [query, setQuery] = useState("");

  // Cap the rendered list so a single-letter query doesn't paint the
  // whole catalog. The user narrows with a couple more characters.
  const results = useMemo(() => filterExercises(catalog, query).slice(0, 12), [catalog, query]);

  const select = (id: string) => {
    onAdd(id);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add an exercise — search by name, muscle, or equipment…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />

      {query.trim() !== "" && (
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">
              No exercises match <span className="font-mono text-[var(--foreground)]">{query}</span>
              .
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => select(e.id)}
                    className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--border)] px-3 py-2 text-left transition last:border-b-0 hover:bg-[var(--surface-2)]"
                  >
                    <span className="text-sm font-medium">{e.name}</span>
                    {e.muscle_groups.length > 0 && (
                      <span className="text-xs text-[var(--muted)]">
                        {e.muscle_groups.join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

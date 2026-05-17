"use client";

import { useEffect, useMemo, useState } from "react";
import { config } from "@/lib/config";
import { listExercises, type Exercise } from "@/lib/api";
import { MuscleGroupPill } from "@/components/muscle-group-pill";

/**
 * Read-only browser for the shared exercise catalog (the same list the
 * agent's tools rely on for slug resolution). Public endpoint, so no
 * auth is required for the API call — the (app) layout still gates
 * access at the navigation level.
 *
 * The catalog will grow over time, so this is built around search-
 * first UX: type to filter by name, muscle group, or equipment, click
 * a row to see description + tagged muscles/equipment.
 */
export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    listExercises()
      .then(setExercises)
      .catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!exercises) return null;
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    // Match against name + tagged muscle groups + equipment. Users will
    // search "barbell" expecting to see all barbell lifts; matching on
    // the tag fields makes that work without a dedicated facet UI.
    return exercises.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      if (e.muscle_groups.some((mg) => mg.toLowerCase().includes(q))) return true;
      if (e.equipment.some((eq) => eq.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [exercises, query]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Exercises</h1>

        {/* Support banner. Surface-2 + a left accent stripe so it reads
            as informational, not a warning or error. */}
        <div className="flex items-start gap-3 rounded-md border border-[var(--border)] border-l-2 border-l-[var(--accent)] bg-[var(--surface-2)] px-3 py-2 text-sm">
          <InfoIcon />
          <p className="flex-1 text-[var(--muted)]">
            Don&apos;t see an exercise you need? Email{" "}
            <a
              href={`mailto:${config.betaContactEmail}?subject=Add%20exercise%20to%20catalog`}
              className="text-[var(--accent)] underline-offset-4 hover:underline"
            >
              {config.betaContactEmail}
            </a>{" "}
            and we&apos;ll get it added to the catalog.
          </p>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, muscle group, or equipment…"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && exercises === null && (
            <p className="text-sm text-[var(--muted)]">Loading exercises…</p>
          )}

          {filtered && filtered.length === 0 && (
            <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
              No exercises match{" "}
              <span className="font-mono text-[var(--foreground)]">
                {query}
              </span>
              .
            </p>
          )}

          {filtered && filtered.length > 0 && (
            <ul className="flex flex-col gap-2">
              {filtered.map((e) => (
                <ExerciseRow
                  key={e.id}
                  exercise={e}
                  expanded={expanded.has(e.id)}
                  onToggle={() => toggleExpanded(e.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function ExerciseRow({
  exercise,
  expanded,
  onToggle,
}: {
  exercise: Exercise;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
      >
        <ChevronIcon expanded={expanded} />
        <span className="flex-1 truncate text-sm font-medium">
          {exercise.name}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3">
          {exercise.description && (
            <p className="text-sm">{exercise.description}</p>
          )}

          {exercise.muscle_groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Targets
              </span>
              {exercise.muscle_groups.map((mg) => (
                <MuscleGroupPill key={mg} muscleGroup={mg} />
              ))}
            </div>
          )}

          {exercise.equipment.length > 0 && (
            <EquipmentRow tags={exercise.equipment} />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Equipment chips — bordered/muted style, distinct from the colored
 * muscle-group pills. Equipment doesn't carry semantic color the way
 * a muscle group does ("barbell" isn't a hue), so a uniform neutral
 * chip reads as "metadata you might filter on" without competing
 * with the muscle-group pills above.
 */
function EquipmentRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
        Equipment
      </span>
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
        >
          {humanizeSlug(t)}
        </span>
      ))}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-[var(--muted)] transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-[var(--accent)]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  );
}

/**
 * Turn an API slug ("flat_bench", "barbell", "incline_bench") into a
 * display string ("Flat Bench", "Barbell", "Incline Bench"). The API
 * uses lowercase + underscores; we only need to undo that for display.
 */
function humanizeSlug(slug: string): string {
  return slug
    .split("_")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteWorkout,
  getMe,
  listExercises,
  listWorkouts,
  type Exercise,
  type User,
  type Workout,
} from "@/lib/api";
import { WorkoutModal } from "@/components/workout-modal";
import { WorkoutDetails, hasMeaningfulName } from "@/components/workout-details";
import { WorkoutsAnalytics } from "@/components/workouts-analytics";
import { workoutVolume } from "@/lib/workout-volume";

/**
 * Workouts overview. Lists the user's sessions for the selected
 * timeframe, paginated server-side. Each row has three interactions:
 *   - Click the body to expand an in-place readonly details panel.
 *   - Click the pencil to open the edit modal.
 *   - Click the trash to delete after confirmation.
 *
 * Timeframe pills drive the API's `since` filter; pagination uses
 * `limit`/`offset`. Catalog is fetched once and reused across pages.
 */

type Timeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAMES: { id: Timeframe; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: null },
];

const PAGE_SIZE = 25;
// Single fetch budget per timeframe. Capped at 100 because that's the
// API's hard limit (see workout.handler.parseWorkoutListOptions). At
// 3–5 sessions/week that's ~5 months of training, which covers the
// 7d/30d/90d timeframes comfortably; the "all" timeframe truncates at
// 100 and the chart shows a "Showing the most recent 100 sessions"
// note so the user sees what's been cut. Raise on both sides
// together if/when single-user volume exceeds this.
const FETCH_LIMIT = 100;

export default function WorkoutsPage() {
  const router = useRouter();
  // Single source of truth: every workout in the active timeframe (up
  // to FETCH_LIMIT). Both the chart (full array, weekly aggregation)
  // and the paginated list (sliced 25 at a time) read from this.
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Workout | null>(null);
  // Tracks which rows have their readonly details panel open. Click on
  // the row body toggles; click on the pencil opens the edit modal.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catalog only needs to load once — it's not user-scoped.
  useEffect(() => {
    listExercises()
      .then(setExercises)
      .catch((err: Error) => setError(err.message));
  }, []);

  // Current user loads once — drives the display unit (lb/kg) for volume.
  // No redirect on a missing token here: the workouts effect already
  // owns that, so we just bail to avoid a double-redirect.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  // One fetch per timeframe change. The list paginates over the
  // returned array client-side rather than firing a new request per
  // page — much smaller blast radius on /workouts and the chart and
  // the list see the same data so deletes / edits stay consistent.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days;
    const since =
      days !== null && days !== undefined
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    listWorkouts(token, { since, limit: FETCH_LIMIT })
      .then((p) => setWorkouts(p.items))
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router, timeframe]);

  // Reset to page 1 whenever the timeframe changes — the offset from
  // the old timeframe almost certainly doesn't address the same data
  // window in the new one.
  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    setPage(1);
  };

  // Slice for the visible page. Memoized so changing `page` doesn't
  // create new arrays for every other dependent computation.
  const visibleWorkouts = useMemo(() => {
    if (!workouts) return null;
    const offset = (page - 1) * PAGE_SIZE;
    return workouts.slice(offset, offset + PAGE_SIZE);
  }, [workouts, page]);

  const total = workouts?.length ?? 0;
  const hasMore = workouts ? page * PAGE_SIZE < workouts.length : false;
  const truncated = workouts ? workouts.length >= FETCH_LIMIT : false;
  const displayUnit = user?.weight_unit ?? "lb";

  // Group the *visible page* by week, not the full timeframe. The chart
  // shows the full-timeframe summary; the list's per-week headers
  // contextualize what's on screen.
  const weekGroups = useMemo(
    () => (visibleWorkouts ? groupByWeek(visibleWorkouts) : null),
    [visibleWorkouts],
  );

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSaved = (updated: Workout) =>
    setWorkouts((ws) => (ws ? ws.map((w) => (w.id === updated.id ? updated : w)) : ws));

  const handleDelete = async (workout: Workout) => {
    const label = hasMeaningfulName(workout.name) ? workout.name : formatDate(workout.performed_at);
    if (!window.confirm(`Delete "${label}"? This removes the workout from your history.`)) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      await deleteWorkout(token, workout.id);
      setWorkouts((ws) => (ws ? ws.filter((w) => w.id !== workout.id) : ws));
      // If the current page just emptied out (we deleted the only row
      // on it and we're not on page 1), step back so the user isn't
      // stranded staring at a blank page. Computed against the
      // post-delete count, which is `current - 1`.
      setPage((p) => {
        if (p <= 1) return p;
        const remainingTotal = (workouts?.length ?? 1) - 1;
        const pagesAfter = Math.ceil(remainingTotal / PAGE_SIZE);
        return Math.min(p, Math.max(1, pagesAfter));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Workouts</h1>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => {
            const active = tf.id === timeframe;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => handleTimeframeChange(tf.id)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <WorkoutsAnalytics
            workouts={workouts}
            exercises={exercises}
            displayUnit={displayUnit}
            days={TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? null}
            truncated={truncated}
            fetchLimit={FETCH_LIMIT}
          />

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && workouts === null && (
            <p className="text-sm text-[var(--muted)]">Loading workouts…</p>
          )}

          {workouts && workouts.length === 0 && <EmptyState />}

          {weekGroups && weekGroups.length > 0 && (
            <div className="flex flex-col gap-8">
              {weekGroups.map((group) => (
                <section key={group.mondayKey} className="flex flex-col gap-3">
                  <WeekHeader group={group} />
                  <ul className="flex flex-col gap-2">
                    {group.workouts.map((w) => (
                      <WorkoutRow
                        key={w.id}
                        workout={w}
                        expanded={expanded.has(w.id)}
                        onToggleExpanded={() => toggleExpanded(w.id)}
                        onEdit={() => setEditing(w)}
                        onDelete={() => handleDelete(w)}
                        exerciseMap={exerciseMap}
                        displayUnit={displayUnit}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {visibleWorkouts && total > 0 && (
            <PaginationFooter
              page={page}
              pageSize={PAGE_SIZE}
              pageCount={visibleWorkouts.length}
              total={total}
              hasMore={hasMore}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </div>
      </div>

      {editing && (
        <WorkoutModal
          workout={editing}
          catalog={exercises}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

function PaginationFooter({
  page,
  pageSize,
  pageCount,
  total,
  hasMore,
  onPrev,
  onNext,
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Range readout uses the actual count of rows on this page rather
  // than page * pageSize so the last page reads honestly when it has
  // fewer than pageSize entries.
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + pageCount;
  const canPrev = page > 1;
  const canNext = hasMore;

  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--muted)]"
      >
        ← Previous
      </button>
      <span className="tabular-nums">
        Showing {from}–{to} of {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--muted)]"
      >
        Next →
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No workouts in this timeframe</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Log a session from the chat by describing it in plain language — try &quot;log
        Tuesday&apos;s push day&quot;.
      </p>
    </div>
  );
}

function WorkoutRow({
  workout,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  exerciseMap,
  displayUnit,
}: {
  workout: Workout;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  exerciseMap: Map<string, Exercise>;
  displayUnit: "lb" | "kg";
}) {
  const named = hasMeaningfulName(workout.name);
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {/* Two sibling buttons in the header so the expand-vs-edit
          interaction is unambiguous. Nesting the pencil inside the
          row button would trip "buttons can't nest" and stop click
          events propagating. min-w-0 on flex children lets `truncate`
          actually clip when names/notes are long. */}
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
        >
          <ChevronIcon expanded={expanded} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              <span className="truncate">
                {named ? workout.name : formatDate(workout.performed_at)}
              </span>
              {workout.personal_records_set.length > 0 && (
                <TrophyIcon
                  count={workout.personal_records_set.length}
                  title={
                    workout.personal_records_set.length === 1
                      ? "This workout set a new personal record"
                      : `This workout set ${workout.personal_records_set.length} new personal records`
                  }
                />
              )}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {named && `${formatDate(workout.performed_at)} · `}
              {formatDuration(workout.performed_at, workout.ended_at ?? null)} ·{" "}
              {workout.exercises.length} {workout.exercises.length === 1 ? "exercise" : "exercises"}{" "}
              ·{" "}
              <span className="tabular-nums">
                {workoutVolume(workout, displayUnit).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                {displayUnit}
              </span>{" "}
              Total Volume
            </p>
            {workout.notes && (
              <p className="truncate text-xs text-[var(--muted)]">{workout.notes}</p>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit workout"
          title="Edit workout"
          className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete workout"
          title="Delete workout"
          className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <WorkoutDetails workout={workout} exerciseMap={exerciseMap} />
        </div>
      )}
    </li>
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
      className={`shrink-0 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrophyIcon({ count, title }: { count: number; title: string }) {
  // Inline trophy with the PR count next to it. Same visual idiom as
  // the sidebar trophy so users learn it once and recognize it across
  // surfaces. Amber to read as "achievement" without using emoji.
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 24 24"
        width={11}
        height={11}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
        <path d="M8 6H5a2 2 0 0 0 0 4h3" />
        <path d="M16 6h3a2 2 0 0 1 0 4h-3" />
        <path d="M12 14v3" />
        <path d="M9 21h6" />
        <path d="M10 17h4l-1 4h-2l-1-4z" />
      </svg>
      {count > 1 && <span className="tabular-nums">{count}</span>}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

// --- week grouping -------------------------------------------------------

type WeekGroup = {
  // ISO date of the Monday that anchors this week (YYYY-MM-DD), used
  // as a React key and as the dedupe key during grouping.
  mondayKey: string;
  monday: Date;
  workouts: Workout[];
  totalDurationMs: number;
  count: number;
};

/**
 * Buckets workouts by Monday-anchored week. Assumes the input is
 * already in display order (newest first); the returned array reflects
 * that order because Map iteration is insertion-ordered. In-progress
 * workouts (no ended_at) don't contribute to totalDurationMs.
 */
function groupByWeek(workouts: Workout[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const w of workouts) {
    const performed = new Date(w.performed_at);
    const monday = startOfMonday(performed);
    const key = isoDate(monday);
    let group = groups.get(key);
    if (!group) {
      group = {
        mondayKey: key,
        monday,
        workouts: [],
        totalDurationMs: 0,
        count: 0,
      };
      groups.set(key, group);
    }
    group.workouts.push(w);
    group.count += 1;
    if (w.ended_at) {
      const dur = new Date(w.ended_at).getTime() - performed.getTime();
      if (dur > 0) group.totalDurationMs += dur;
    }
  }
  return [...groups.values()];
}

/** Midnight (local) of the Monday in the same ISO week as `d`. */
function startOfMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 0 = Sunday, 1 = Monday, ..., 6 = Saturday. Offset to Monday
  // is (day + 6) % 7 — Sun→6 days back, Mon→0, Tue→1, etc.
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function WeekHeader({ group }: { group: WeekGroup }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{formatWeekLabel(group.monday)}</h2>
        <span className="text-xs text-[var(--muted)]">{formatWeekRange(group.monday)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Total time" value={formatTotalDuration(group.totalDurationMs)} />
        <StatTile label="Activities" value={String(group.count)} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Friendly title for a week. "This week" / "Last week" win when they
 * apply; otherwise "Week of <Mon D>". Year is omitted from the title
 * since the right-side range carries it when it matters.
 */
function formatWeekLabel(monday: Date): string {
  const today = new Date();
  const thisMonday = startOfMonday(today);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  if (monday.getTime() === thisMonday.getTime()) return "This week";
  if (monday.getTime() === lastMonday.getTime()) return "Last week";
  return `Week of ${monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/**
 * Mon–Sun span. Drops the leading month when both ends share one
 * ("May 11 – 17"), and shows the year only when the week falls outside
 * the current calendar year so the common case stays compact.
 */
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const now = new Date();
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const includeYear =
    monday.getFullYear() !== now.getFullYear() || sunday.getFullYear() !== now.getFullYear();
  const start = monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = sunday.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  return includeYear ? `${start} – ${end}, ${sunday.getFullYear()}` : `${start} – ${end}`;
}

/** Same format as the row's `formatDuration` but sums across the week. */
function formatTotalDuration(ms: number): string {
  if (ms <= 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// --- row-level formatting helpers ----------------------------------------

/**
 * Friendly date label. For very recent dates we use "Today" / "Yesterday"
 * since those are what lifters actually think in; older entries use the
 * full month + day so the timestamp is unambiguous.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThat.getTime()) / (24 * 60 * 60 * 1000),
  );

  let dayLabel: string;
  if (dayDiff === 0) dayLabel = "Today";
  else if (dayDiff === 1) dayLabel = "Yesterday";
  else if (dayDiff > 1 && dayDiff < 7)
    dayLabel = d.toLocaleDateString("en-US", { weekday: "long" });
  else
    dayLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dayLabel}, ${time}`;
}

/**
 * Duration as `Xh Ym` or `Mm` when under an hour. Returns an em-dash
 * for in-progress workouts (no ended_at recorded).
 */
function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

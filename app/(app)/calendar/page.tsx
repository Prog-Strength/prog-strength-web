"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { listWorkouts, type Workout } from "@/lib/api";

/**
 * Month-grid calendar with workout markers. Same data source as the
 * Workouts page (`listWorkouts`) — workouts are grouped by local-date
 * key so multiple sessions on the same day land in the same cell.
 *
 * Known limit (shared with the Workouts page): the API caps `/workouts`
 * at 50 most-recent rows and the handler doesn't yet expose
 * since/until query params. For a user with >50 workouts the older
 * months will appear empty. Fix when this actually matters.
 */

const MAX_VISIBLE_PILLS = 2;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cursor identifies which month we're viewing. year + 0-indexed month
  // — using a `Date` directly would carry day/time noise we'd have to
  // strip on every prev/next.
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listWorkouts(token)
      .then(setWorkouts)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  // Bucket workouts by local-date key so the cell lookup is O(1) per
  // day during render. Key is `YYYY-M-D` in *local* time — the user's
  // perception of "what day did I work out" is local-tz, even if the
  // RFC3339 timestamps came across in UTC.
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    if (!workouts) return map;
    for (const w of workouts) {
      const key = localDateKey(new Date(w.performed_at));
      const list = map.get(key);
      if (list) list.push(w);
      else map.set(key, [w]);
    }
    // Sort each day's workouts by start time so stacked pills read
    // morning → evening top-to-bottom.
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.performed_at).getTime() -
          new Date(b.performed_at).getTime(),
      );
    }
    return map;
  }, [workouts]);

  const days = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const monthLabel = useMemo(
    () =>
      new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [cursor],
  );

  const goPrev = () =>
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 },
    );
  const goNext = () =>
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 },
    );
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const todayKey = localDateKey(new Date());

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{monthLabel}</h1>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1">
          <NavButton onClick={goPrev} label="Previous month" direction="left" />
          <NavButton onClick={goNext} label="Next month" direction="right" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Weekday header row. Tighter padding so it doesn't compete
              with the day cells visually. */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-1 text-center text-xs font-medium text-[var(--muted)]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === cursor.month;
              const key = localDateKey(day);
              const dayWorkouts = workoutsByDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <DayCell
                  key={key}
                  day={day}
                  inMonth={inMonth}
                  isToday={isToday}
                  workouts={dayWorkouts}
                />
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  workouts,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  workouts: Workout[];
}) {
  const visible = workouts.slice(0, MAX_VISIBLE_PILLS);
  const hiddenCount = workouts.length - visible.length;

  // Cell skeleton: every cell has a fixed minimum height so the grid
  // rows stay visually balanced even when a day has no workouts. The
  // accent ring on today's cell stays inside the border to avoid
  // shifting any adjacent cells.
  const baseClasses =
    "flex min-h-[88px] flex-col gap-1 rounded-md border p-1.5 transition";
  const stateClasses = isToday
    ? "border-[var(--accent)] bg-[var(--surface)]"
    : "border-[var(--border)] bg-[var(--surface)]";
  const labelClasses = inMonth
    ? "text-[var(--foreground)]"
    : "text-[var(--muted)] opacity-60";

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      aria-label={`${day.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}${
        workouts.length > 0
          ? `, ${workouts.length} ${workouts.length === 1 ? "workout" : "workouts"}`
          : ""
      }`}
    >
      <div className={`px-1 text-xs font-medium ${labelClasses}`}>
        {day.getDate()}
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((w) => (
          <WorkoutPill key={w.id} workout={w} />
        ))}
        {hiddenCount > 0 && (
          <span className="px-1 text-[10px] text-[var(--muted)]">
            +{hiddenCount} more
          </span>
        )}
      </div>
    </div>
  );
}

function WorkoutPill({ workout }: { workout: Workout }) {
  const time = new Date(workout.performed_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  // Workout name is auto-generated as "Workout - <date>" when the user
  // didn't set one explicitly — that text is redundant on a calendar
  // (the date is the cell itself), so the pill just shows the time.
  // The full name appears on hover via title for the curious user.
  return (
    <span
      title={workout.name ? `${time} · ${workout.name}` : time}
      className="truncate rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-fg)]"
    >
      {time}
    </span>
  );
}

function NavButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--muted)] transition hover:text-[var(--foreground)]"
    >
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

// --- date helpers ----------------------------------------------------------

/**
 * Build a 6-week (42-day) grid starting on the Sunday that contains
 * the first of the month. The fixed 42-cell shape keeps prev/next
 * navigation from reshaping the layout when months have 4, 5, or 6
 * visible weeks; trailing days from the next month fill the bottom row
 * when the actual month is short.
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sunday
  const start = new Date(year, month, 1 - startDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

/**
 * Local-date key in `YYYY-M-D` form (zero-padding not required since
 * we only compare equality, not lex-sort). Using local time deliberately
 * — the user's mental model of "what day was that workout" is local-tz,
 * even if the API timestamps came across in UTC.
 */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

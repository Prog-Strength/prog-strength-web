"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Workout } from "@/lib/api";
import { workoutVolume } from "@/lib/workout-volume";

/**
 * Volume sibling of the duration chart: total weekly training volume
 * (sum of reps × weight) over the active timeframe — the "am I moving
 * enough weight?" answer alongside "did I spend enough time lifting?".
 *
 * Deliberately chrome-less. Unlike the duration chart this renders only
 * the inner chart block (loading / empty / area) plus the truncated
 * note — the analytics wrapper owns the card border and the shared
 * header so the two views can sit under one set of totals.
 *
 * Purely presentational. The workouts array, the timeframe's `days`,
 * and the truncation flags are passed in by the page so a single fetch
 * hydrates both this chart and the paginated list below.
 */

const CHART_HEIGHT = 200;

export function WorkoutVolumeChart({
  workouts,
  days,
  displayUnit,
  truncated,
  fetchLimit,
}: {
  // `null` while the parent is still loading. Empty array = no
  // workouts in the window (rendered as an empty-state block).
  workouts: Workout[] | null;
  // Days back from now this window covers, or null for "all".
  // Drives the X-axis bucket span so empty weeks at the edge of the
  // window still appear as zero-points instead of clipping the line.
  days: number | null;
  // The unit each set's weight is converted toward before summing, so
  // the totals match the user's preference and the per-card badges.
  displayUnit: "lb" | "kg";
  // True when the parent's fetch returned exactly `fetchLimit` rows
  // and the API may have more — the chart surfaces this so the user
  // understands why older data isn't included.
  truncated: boolean;
  fetchLimit: number;
}) {
  const summary = useMemo(
    () => summarize(workouts ?? [], days, displayUnit),
    [workouts, days, displayUnit],
  );

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {workouts === null ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : summary.weeks.length === 0 || summary.totalVolume === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
            No completed workouts in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.weeks} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={formatYTick}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "#52525b", strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.375rem",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(v) =>
                  typeof v === "number" ? formatWeekRangeFromMonday(new Date(v)) : ""
                }
                formatter={(v) =>
                  typeof v === "number"
                    ? [
                        `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${displayUnit}`,
                        "Volume",
                      ]
                    : ["—", "Volume"]
                }
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#volume-fill)"
                isAnimationActive={false}
                dot={{ r: 3, fill: "#3b82f6", stroke: "#3b82f6" }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {truncated && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Showing the most recent {fetchLimit} sessions. Older data isn&apos;t included in this
          chart yet.
        </p>
      )}
    </>
  );
}

// --- aggregation --------------------------------------------------

type WeekPoint = {
  weekKey: string;
  weekStart: Date;
  // Unix-ms timestamp of the Monday so recharts' numeric XAxis can
  // place each point linearly without us converting per-tick.
  t: number;
  // Total training volume (reps × weight) for the week.
  volume: number;
};

type Summary = {
  totalVolume: number;
  weeks: WeekPoint[];
};

/**
 * Buckets workouts into Monday-anchored weeks and totals each week's
 * training volume. Weeks with no sessions still appear so the line dips
 * to zero — a multi-week gap shows up visually rather than being
 * smoothed away by adjacent points.
 *
 * Unlike the duration chart this counts every workout in the window,
 * not only completed ones: volume comes from logged sets, so an
 * in-progress (no `ended_at`) session still has real volume to show.
 *
 * For bounded timeframes (7d/30d/90d) the bucket span is derived from
 * the timeframe so even an empty user sees a chart shaped like the
 * window. For the "all" timeframe (days === null) the span runs from
 * the oldest workout in the array to today.
 */
function summarize(workouts: Workout[], days: number | null, displayUnit: "lb" | "kg"): Summary {
  const now = new Date();
  const since =
    days !== null
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : workouts.length > 0
        ? new Date(Math.min(...workouts.map((w) => new Date(w.performed_at).getTime())))
        : now;

  const weeksByKey = new Map<string, WeekPoint>();
  const orderedKeys: string[] = [];
  for (
    let cursor = startOfMonday(since);
    cursor.getTime() <= startOfMonday(now).getTime();
    cursor = addDays(cursor, 7)
  ) {
    const key = isoDate(cursor);
    orderedKeys.push(key);
    weeksByKey.set(key, {
      weekKey: key,
      weekStart: new Date(cursor),
      t: cursor.getTime(),
      volume: 0,
    });
  }

  let totalVolume = 0;
  for (const w of workouts) {
    const volume = workoutVolume(w, displayUnit);
    if (!Number.isFinite(volume) || volume <= 0) continue;
    totalVolume += volume;
    const bucket = weeksByKey.get(isoDate(startOfMonday(new Date(w.performed_at))));
    if (bucket) bucket.volume += volume;
  }

  return {
    totalVolume,
    weeks: orderedKeys.map((k) => weeksByKey.get(k)!),
  };
}

// --- helpers ------------------------------------------------------

function startOfMonday(d: Date): Date {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 0 = Sunday, 1 = Monday, … 6 = Saturday.
  // Monday-anchored offset: Sun→6, Mon→0, Tue→1, …
  const offset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - offset);
  return local;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatYTick(volume: number): string {
  if (volume <= 0) return "0";
  return Math.round(volume).toLocaleString();
}

function formatWeekRangeFromMonday(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const monStr = monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const sunStr = sameMonth
    ? String(sunday.getDate())
    : sunday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
  return `${monStr} – ${sunStr}`;
}

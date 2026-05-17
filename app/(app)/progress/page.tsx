"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clearToken, getToken } from "@/lib/auth";
import {
  listExercises,
  listProgression,
  type Exercise,
  type Progression,
  type Trendline,
} from "@/lib/api";

/**
 * Progress page — pick an exercise, pick a timeframe, see the
 * estimated-1RM trend over time. Data comes from the API's
 * /workouts/progression endpoint which computes Epley 1RM per set,
 * averages/min/maxes per workout, and fits least-squares trendlines.
 * This page is the chart layer on top of that.
 *
 * Empty/error states are handled inline; the user always sees one of:
 * pick-an-exercise prompt, loading state, "no data" state, error
 * banner, or the chart.
 */

type Timeframe = "30d" | "60d" | "90d";

const TIMEFRAMES: { id: Timeframe; label: string; days: number }[] = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "60d", label: "Last 60 days", days: 60 },
  { id: "90d", label: "Last 90 days", days: 90 },
];

// Chart palette — three shades of accent blue keep the avg/max/min
// series visually related (they're three views of the same lift, not
// three independent metrics). Trendlines reuse each series' color but
// dashed so the actual data points stay primary.
const COLOR_AVG = "#3b82f6"; // blue-500 — matches the app's --accent
const COLOR_MAX = "#93c5fd"; // blue-300 — lighter, "ceiling"
const COLOR_MIN = "#1d4ed8"; // blue-700 — darker, "floor"

export default function ProgressPage() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [progression, setProgression] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the catalog once on mount; populates the exercise picker.
  // No auth needed for /exercises so the page renders even if the
  // user's token is stale, but progression lookups will 401 below.
  useEffect(() => {
    listExercises()
      .then((es) => {
        const sorted = [...es].sort((a, b) => a.name.localeCompare(b.name));
        setExercises(sorted);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  // Fetch progression whenever the user changes selection or
  // timeframe. Empty exerciseId is the initial state — no fetch.
  useEffect(() => {
    if (!exerciseId) {
      setProgression(null);
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? 90;
    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

    setLoading(true);
    setError(null);
    listProgression(token, exerciseId, since.toISOString(), until.toISOString())
      .then(setProgression)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
        setProgression(null);
      })
      .finally(() => setLoading(false));
  }, [exerciseId, timeframe, router]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Progress</h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            aria-label="Exercise"
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none sm:w-72"
          >
            <option value="">Pick an exercise…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {TIMEFRAMES.map((tf) => {
              const active = tf.id === timeframe;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
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
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!exerciseId && !error && (
            <EmptyHint
              title="Pick an exercise to see your progress"
              body="Estimated 1RM is plotted per workout (Epley formula), with a least-squares trendline to show whether you're trending up, flat, or down."
            />
          )}

          {exerciseId && loading && (
            <p className="text-sm text-[var(--muted)]">Loading progression…</p>
          )}

          {exerciseId &&
            !loading &&
            progression &&
            progression.points.length === 0 && (
              <EmptyHint
                title="No data for this exercise in the selected range"
                body="Try a longer window, or log a few sessions of this lift via chat and come back."
              />
            )}

          {exerciseId &&
            !loading &&
            progression &&
            progression.points.length > 0 && (
              <ProgressionView progression={progression} />
            )}
        </div>
      </div>
    </main>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{body}</p>
    </div>
  );
}

function ProgressionView({ progression }: { progression: Progression }) {
  const { points, trendline_avg, unit, skipped_other_unit_count } = progression;

  // Pre-compute chart data: actual values per workout + interpolated
  // trendline values at each X. Putting everything in a single array
  // keyed by performed_at keeps recharts' Line components happy with
  // a shared dataKey strategy.
  const chartData = useMemo(
    () =>
      points.map((p) => {
        const t = new Date(p.performed_at).getTime();
        return {
          t,
          avg: p.avg_estimated_1rm,
          max: p.max_estimated_1rm,
          min: p.min_estimated_1rm,
          trend_avg: interpolateTrend(progression.trendline_avg, t),
          trend_max: interpolateTrend(progression.trendline_max, t),
          trend_min: interpolateTrend(progression.trendline_min, t),
          set_count: p.set_count,
        };
      }),
    [points, progression.trendline_avg, progression.trendline_max, progression.trendline_min],
  );

  // Stat tiles: latest avg, best max, period change %. "Change" uses
  // the avg trendline's endpoints since that captures the overall
  // direction without being whipsawed by a single noisy data point.
  const latestAvg = points[points.length - 1]?.avg_estimated_1rm ?? 0;
  const bestMax = points.reduce(
    (acc, p) => (p.max_estimated_1rm > acc ? p.max_estimated_1rm : acc),
    0,
  );
  const changePct =
    trendline_avg && trendline_avg.start_value > 0
      ? ((trendline_avg.end_value - trendline_avg.start_value) /
          trendline_avg.start_value) *
        100
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={`${formatNumber(latestAvg)} ${unit}`} label="Latest avg 1RM" />
        <StatTile value={`${formatNumber(bestMax)} ${unit}`} label="Best estimated 1RM" />
        <StatTile
          value={formatChange(changePct)}
          label="Trend over period"
          tone={
            changePct === null
              ? "neutral"
              : changePct > 0.5
                ? "positive"
                : changePct < -0.5
                  ? "negative"
                  : "neutral"
          }
        />
      </div>

      {skipped_other_unit_count > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {skipped_other_unit_count}{" "}
          {skipped_other_unit_count === 1 ? "set was" : "sets were"} excluded
          from the chart because they used the other weight unit.
        </p>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 16, bottom: 10, left: 0 }}
            >
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
                tickFormatter={(v: number) => `${Math.round(v)}`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.375rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#ededed", marginBottom: "4px" }}
                itemStyle={{ color: "#ededed" }}
                // recharts types these callbacks loosely (label is
                // ReactNode, value is `ValueType | undefined`); we
                // narrow inside the callback body so the formatter
                // logic stays simple.
                labelFormatter={(label) => {
                  if (typeof label !== "number") return "";
                  return new Date(label).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                }}
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : 0;
                  return [`${formatNumber(n)} ${unit}`, name as string];
                }}
              />

              {/* Trendlines drawn first so the dashed lines sit
                  behind the actual data points visually. */}
              <Line
                type="monotone"
                dataKey="trend_max"
                name="Max trend"
                stroke={COLOR_MAX}
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trend_avg"
                name="Avg trend"
                stroke={COLOR_AVG}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trend_min"
                name="Min trend"
                stroke={COLOR_MIN}
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />

              {/* Actual series — avg gets the visual hierarchy (thicker
                  stroke, larger dots) since it's the smoothed signal
                  the user cares about most. */}
              <Line
                type="monotone"
                dataKey="max"
                name="Max"
                stroke={COLOR_MAX}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: COLOR_MAX }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avg"
                name="Avg"
                stroke={COLOR_AVG}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLOR_AVG }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="min"
                name="Min"
                stroke={COLOR_MIN}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: COLOR_MIN }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compact legend — recharts' built-in <Legend> is fine but
            wastes vertical space. A flat row below the chart is
            tighter and reads better on narrow viewports. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <LegendSwatch color={COLOR_AVG} label="Avg" />
          <LegendSwatch color={COLOR_MAX} label="Max" />
          <LegendSwatch color={COLOR_MIN} label="Min" />
          <span className="text-[10px] uppercase tracking-wider">
            Dashed = trendline
          </span>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneColor =
    tone === "positive"
      ? "text-[#86efac]" // emerald-300 — slight win color independent of accent
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className={`text-2xl font-semibold tracking-tight ${toneColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// --- helpers --------------------------------------------------------------

/**
 * Linear interpolation of a trendline at timestamp `x`. The API gave
 * us the two endpoints (at since/until), so this is just slope-form
 * arithmetic. Returns null if the trendline is missing — the chart
 * sees null and renders a gap in the dashed line, which is the right
 * behavior when the regression couldn't be fit.
 */
function interpolateTrend(trend: Trendline | null, x: number): number | null {
  if (!trend) return null;
  const startX = new Date(trend.start_at).getTime();
  const endX = new Date(trend.end_at).getTime();
  const span = endX - startX;
  if (span === 0) return trend.start_value;
  return (
    trend.start_value +
    ((x - startX) / span) * (trend.end_value - trend.start_value)
  );
}

function formatNumber(v: number): string {
  // One decimal place, drop trailing .0 — matches the backend's
  // round1 convention so values display consistently with how
  // they're stored in the JSON.
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatChange(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

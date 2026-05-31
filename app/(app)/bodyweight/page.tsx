"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clearToken, getToken } from "@/lib/auth";
import {
  createBodyweightEntry,
  deleteBodyweightEntry,
  listBodyweight,
  type BodyweightEntry,
} from "@/lib/api";

/**
 * Bodyweight — multi-per-day-aware view with time-range tabs, summary
 * stat tiles, a daily-average trend chart, and a paginated entries
 * table. See prog-strength-docs/sows/bodyweight-multi-per-day.md.
 *
 * Single GET /bodyweight on mount. Everything below — range
 * filtering, daily aggregation, stat computation, table pagination —
 * happens client-side off the one fetched list. A user weighing
 * twice a day for five years is ~3,650 rows / ~365 KB JSON, which
 * is genuinely cheaper than the engineering overhead of any
 * server-side filter or pagination.
 */

const UNIT_PREFERENCE_KEY = "ps_bodyweight_unit";
const PAGE_SIZE = 20;

type RangeKey = "30" | "60" | "90" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30", label: "30 days", days: 30 },
  { key: "60", label: "60 days", days: 60 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All", days: null },
];

export default function BodyweightPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<BodyweightEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("30");
  const [page, setPage] = useState(1);

  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listBodyweight(token)
      .then(setEntries)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Display unit: most-recent entry's unit, fallback to "lb" when no
  // readings exist. Stat tiles + chart convert other-unit rows to
  // this for consistent display; the table preserves original units
  // so users who occasionally log in the other unit can still see
  // exactly what they logged.
  const displayUnit: "lb" | "kg" = useMemo(() => {
    if (!entries || entries.length === 0) return "lb";
    return entries[0].unit;
  }, [entries]);

  // Filter by selected range, sorted desc by measured_at. The API
  // already returns desc, but we re-sort defensively in case future
  // API changes loosen that contract.
  const entriesInRange = useMemo(() => {
    if (!entries) return [];
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
    );
    const rangeDef = RANGES.find((r) => r.key === range);
    if (!rangeDef || rangeDef.days === null) return sorted;
    // Cutoff = days back from NOW, not back from the most-recent
    // measurement. Gaps in logging show as gaps in the chart rather
    // than the window sliding earlier in time.
    const cutoffMs = Date.now() - rangeDef.days * 24 * 60 * 60 * 1000;
    return sorted.filter(
      (e) => new Date(e.measured_at).getTime() >= cutoffMs,
    );
  }, [entries, range]);

  const totalPages = Math.max(
    1,
    Math.ceil(entriesInRange.length / PAGE_SIZE),
  );
  const pageEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return entriesInRange.slice(start, start + PAGE_SIZE);
  }, [entriesInRange, page]);

  // Reset to page 1 when the range changes — keeping the current
  // page can land users on a now-empty page (e.g., switching from
  // "All" with 200 entries on page 5 down to "30 days" with only
  // 40 entries / 2 pages).
  useEffect(() => {
    setPage(1);
  }, [range]);

  function handleCreate(payload: {
    weight: number;
    unit: "lb" | "kg";
    measured_at?: string;
  }) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    createBodyweightEntry(token, payload)
      .then(() => refetch())
      .catch((err: Error) => setCreateError(err.message))
      .finally(() => setCreateBusy(false));
  }

  function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this entry? Corrections are delete + re-add — the trend chart will update.",
      )
    ) {
      return;
    }
    const token = getToken();
    if (!token) return;
    setRowBusyID(id);
    deleteBodyweightEntry(token, id)
      .then(() => refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setRowBusyID(null));
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Bodyweight</h1>
        <p className="text-xs text-[var(--muted)]">
          Multi-per-day OK — log morning + evening readings, the chart
          shows the daily-average trend through the spread.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <TimeRangeTabs value={range} onChange={setRange} />

          <StatTiles
            entries={entriesInRange}
            displayUnit={displayUnit}
          />

          <Chart entries={entriesInRange} displayUnit={displayUnit} />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Log a reading
            </h2>
            <EntryForm
              busy={createBusy}
              error={createError}
              onSubmit={handleCreate}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Entries</h2>
            {entries === null && (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            )}
            {entries && entriesInRange.length === 0 && (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                {entries.length === 0
                  ? "No readings yet. Log your morning weight above and come back tomorrow."
                  : "No readings in this range — try widening the time range above."}
              </p>
            )}
            {entries && entriesInRange.length > 0 && (
              <BodyweightTable
                entries={pageEntries}
                rowBusyID={rowBusyID}
                onDelete={handleDelete}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalCount={entriesInRange.length}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// --- Time range tabs ----------------------------------------------

function TimeRangeTabs({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  // Border-b on the parent doubles as the "white separator" the SOW
  // describes — same pattern the nutrition page toolbar uses for the
  // line between toolbar and the daily log. Active tab gets the
  // pressed-button treatment (accent fill, inset shadow,
  // translate-y-px) matching the date-tile-strip's selected state.
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
      {RANGES.map((r) => {
        const selected = r.key === value;
        const stateClasses = selected
          ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)] translate-y-px"
          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]";
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${stateClasses}`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Stat tiles ---------------------------------------------------

function StatTiles({
  entries,
  displayUnit,
}: {
  entries: BodyweightEntry[];
  displayUnit: "lb" | "kg";
}) {
  const stats = useMemo(
    () => computeStats(entries, displayUnit),
    [entries, displayUnit],
  );

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Average"
        value={
          stats.avg !== null
            ? `${formatNumber(stats.avg)} ${displayUnit}`
            : "—"
        }
        sublabel={
          stats.count > 0
            ? `${stats.count} reading${stats.count === 1 ? "" : "s"}`
            : "No readings"
        }
      />
      <StatTile
        label="Min"
        value={
          stats.min !== null
            ? `${formatNumber(stats.min.weight)} ${displayUnit}`
            : "—"
        }
        sublabel={
          stats.min !== null ? formatShortDate(stats.min.date) : "—"
        }
      />
      <StatTile
        label="Max"
        value={
          stats.max !== null
            ? `${formatNumber(stats.max.weight)} ${displayUnit}`
            : "—"
        }
        sublabel={
          stats.max !== null ? formatShortDate(stats.max.date) : "—"
        }
      />
      <StatTile
        label="Delta"
        value={
          stats.delta !== null
            ? `${stats.delta >= 0 ? "+" : ""}${formatNumber(stats.delta)} ${displayUnit}`
            : "—"
        }
        sublabel={
          stats.deltaPercent !== null
            ? `${stats.deltaPercent >= 0 ? "+" : ""}${formatNumber(stats.deltaPercent)}%`
            : "Need 2+ days"
        }
      />
    </section>
  );
}

function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-[10px] text-[var(--muted)]">{sublabel}</p>
    </div>
  );
}

// --- Chart --------------------------------------------------------

function Chart({
  entries,
  displayUnit,
}: {
  entries: BodyweightEntry[];
  displayUnit: "lb" | "kg";
}) {
  // Two series share the X axis ("t" = ms-since-epoch):
  //   - Scatter: every raw measurement at its actual measured_at
  //     time. Lighter opacity so same-day spread reads as context
  //     for the trend, not as noise competing with it.
  //   - Line: daily averages. Group by local-day, take the mean,
  //     plot at noon of that day so the line sits visually centered
  //     through the morning + evening scatter points around it.
  const { rawPoints, avgPoints } = useMemo(() => {
    const raw = entries.map((e) => ({
      t: new Date(e.measured_at).getTime(),
      weight: convertWeight(e.weight, e.unit, displayUnit),
    }));
    const byDay = new Map<number, number[]>();
    for (const e of entries) {
      const d = new Date(e.measured_at);
      const dayStart = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).getTime();
      const arr = byDay.get(dayStart) ?? [];
      arr.push(convertWeight(e.weight, e.unit, displayUnit));
      byDay.set(dayStart, arr);
    }
    const avg: { t: number; avg: number }[] = [];
    for (const [dayStart, weights] of byDay) {
      const dailyMean =
        weights.reduce((a, b) => a + b, 0) / weights.length;
      avg.push({ t: dayStart + 12 * 60 * 60 * 1000, avg: dailyMean });
    }
    avg.sort((a, b) => a.t - b.t);
    return { rawPoints: raw, avgPoints: avg };
  }, [entries, displayUnit]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No readings in this range.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
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
              domain={[
                (dataMin: number) => Math.floor(dataMin - 2),
                (dataMax: number) => Math.ceil(dataMax + 2),
              ]}
              width={48}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            <Tooltip
              cursor={{ stroke: "#52525b", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "0.375rem",
                padding: "8px 10px",
                fontSize: "12px",
              }}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(label) => {
                const v =
                  typeof label === "number" ? label : Number(label);
                return new Date(v).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              }}
              formatter={(value, name) => {
                const v =
                  typeof value === "number" ? value : Number(value);
                return [
                  `${formatNumber(v)} ${displayUnit}`,
                  name === "weight" ? "Reading" : "Daily avg",
                ];
              }}
            />
            <Scatter
              name="weight"
              data={rawPoints}
              dataKey="weight"
              fill="#3b82f6"
              fillOpacity={0.4}
              isAnimationActive={false}
            />
            <Line
              name="avg"
              data={avgPoints}
              type="monotone"
              dataKey="avg"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 3 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
        <Legend color="#3b82f6" label={`Daily avg (${displayUnit})`} />
        <Legend color="#3b82f6" label="Reading" scatter />
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  scatter,
}: {
  color: string;
  label: string;
  scatter?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {scatter ? (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
      ) : (
        <span
          aria-hidden
          className="inline-block h-0.5 w-5"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  );
}

// --- Table --------------------------------------------------------

function BodyweightTable({
  entries,
  rowBusyID,
  onDelete,
  page,
  totalPages,
  onPageChange,
  totalCount,
}: {
  entries: BodyweightEntry[];
  rowBusyID: string | null;
  onDelete: (id: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalCount: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Time</th>
            <th className="px-4 py-2 text-right">Weight</th>
            <th className="px-4 py-2 text-right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              className="border-b border-[var(--border)]/50 last:border-b-0"
            >
              <td className="px-4 py-2 tabular-nums">
                {formatRowDate(e.measured_at)}
              </td>
              <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                {formatRowTime(e.measured_at)}
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {formatNumber(e.weight)}{" "}
                <span className="text-[var(--muted)]">{e.unit}</span>
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  disabled={rowBusyID === e.id}
                  className="text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  totalCount,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--background)] px-4 py-2 text-xs text-[var(--muted)]">
      <p className="tabular-nums">
        Page {page} of {totalPages} · {totalCount} total
      </p>
      <div className="flex items-center gap-1">
        <PaginationBtn
          label="« First"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
        />
        <PaginationBtn
          label="‹ Prev"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        />
        <PaginationBtn
          label="Next ›"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        />
        <PaginationBtn
          label="Last »"
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
        />
      </div>
    </div>
  );
}

function PaginationBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}

// --- Entry form (unchanged from prior shape) ----------------------

function EntryForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (payload: {
    weight: number;
    unit: "lb" | "kg";
    measured_at?: string;
  }) => void;
}) {
  const [weight, setWeight] = useState("");
  // Persist the unit choice across visits so users who measure in kg
  // don't have to flip the toggle every morning. localStorage-only;
  // not auth-sensitive enough to deserve a server round trip. Read
  // via the lazy useState initializer so the value is in place on
  // first render and React 19's "no sync setState in effect" rule
  // doesn't trip.
  const [unit, setUnit] = useState<"lb" | "kg">(() => {
    if (typeof window === "undefined") return "lb";
    const stored = window.localStorage.getItem(UNIT_PREFERENCE_KEY);
    return stored === "kg" || stored === "lb" ? stored : "lb";
  });
  const [measuredAtLocal, setMeasuredAtLocal] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UNIT_PREFERENCE_KEY, unit);
    }
  }, [unit]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setLocalError("Weight must be a positive number.");
      return;
    }
    let measured_at: string | undefined;
    if (measuredAtLocal) {
      const d = new Date(measuredAtLocal);
      if (Number.isNaN(d.getTime())) {
        setLocalError("Measured-at couldn't be parsed.");
        return;
      }
      measured_at = d.toISOString();
    }
    onSubmit({ weight: w, unit, measured_at });
    setWeight("");
    setMeasuredAtLocal("");
  }

  const shownError = error ?? localError;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
          Weight
        </span>
        <input
          type="number"
          min={0}
          step="any"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="185"
          disabled={busy}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
        />
      </label>
      <label className="flex w-full flex-col gap-1 text-xs sm:w-24">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
          Unit
        </span>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as "lb" | "kg")}
          disabled={busy}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        >
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
          When
        </span>
        <input
          type="datetime-local"
          value={measuredAtLocal}
          onChange={(e) => setMeasuredAtLocal(e.target.value)}
          disabled={busy}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
      >
        {busy ? "Logging…" : "Log"}
      </button>
      {shownError && (
        <p className="w-full text-xs text-[var(--danger)] sm:ml-3">
          {shownError}
        </p>
      )}
    </form>
  );
}

// --- helpers ------------------------------------------------------

const LB_PER_KG = 2.20462;

/**
 * Convert a weight value between lb and kg. No-op when the source +
 * target units match. Used to normalize mixed-unit entries to the
 * display unit for stat tiles + chart math; the table preserves
 * each entry's original unit.
 */
function convertWeight(
  weight: number,
  from: "lb" | "kg",
  to: "lb" | "kg",
): number {
  if (from === to) return weight;
  return from === "kg" ? weight * LB_PER_KG : weight / LB_PER_KG;
}

type Stats = {
  count: number;
  avg: number | null;
  min: { weight: number; date: string } | null;
  max: { weight: number; date: string } | null;
  delta: number | null;
  deltaPercent: number | null;
};

/**
 * Compute the four stat-tile values over a window of entries.
 *
 * Delta uses first-day-average vs last-day-average rather than
 * first-vs-last raw reading — matches the chart's trend line and
 * isn't pulled around by a single bad scale read at either endpoint.
 * Requires at least two distinct local days in the window; below
 * that delta and deltaPercent both return null.
 */
function computeStats(
  entries: BodyweightEntry[],
  displayUnit: "lb" | "kg",
): Stats {
  if (entries.length === 0) {
    return {
      count: 0,
      avg: null,
      min: null,
      max: null,
      delta: null,
      deltaPercent: null,
    };
  }
  const normalized = entries.map((e) => ({
    weight: convertWeight(e.weight, e.unit, displayUnit),
    measured_at: e.measured_at,
  }));
  const sum = normalized.reduce((a, b) => a + b.weight, 0);
  const avg = sum / normalized.length;
  const min = normalized.reduce(
    (acc, w) => (w.weight < acc.weight ? w : acc),
    normalized[0],
  );
  const max = normalized.reduce(
    (acc, w) => (w.weight > acc.weight ? w : acc),
    normalized[0],
  );

  // Group by local-day, mean within day, compare first vs last day's mean.
  const byDay = new Map<number, number[]>();
  for (const w of normalized) {
    const d = new Date(w.measured_at);
    const dayStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    const arr = byDay.get(dayStart) ?? [];
    arr.push(w.weight);
    byDay.set(dayStart, arr);
  }
  const dayStartTimes = [...byDay.keys()].sort((a, b) => a - b);
  let delta: number | null = null;
  let deltaPercent: number | null = null;
  if (dayStartTimes.length >= 2) {
    const firstAvg = mean(byDay.get(dayStartTimes[0]) ?? []);
    const lastAvg = mean(
      byDay.get(dayStartTimes[dayStartTimes.length - 1]) ?? [],
    );
    delta = lastAvg - firstAvg;
    deltaPercent = firstAvg > 0 ? (delta / firstAvg) * 100 : null;
  }

  return {
    count: entries.length,
    avg,
    min: { weight: min.weight, date: min.measured_at },
    max: { weight: max.weight, date: max.measured_at },
    delta,
    deltaPercent,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRowTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

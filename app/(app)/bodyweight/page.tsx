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
 * Bodyweight — chart-first layout with the daily-average trend line as
 * the focal point. The log form lives behind a pencil-icon "Log"
 * button next to the entries table, matching the nutrition page's
 * "+ Quick Add" pattern so the page surface stays calm until the
 * user explicitly opts into logging.
 *
 * Page flow top → bottom:
 *   - Time-range tabs (with the border-b doubling as the separator)
 *   - Chart card: graph at the top, stat tiles tucked inside the
 *     same box below the chart so the two are visually one unit
 *   - Pencil-Log toolbar + separator line
 *   - Paginated entries table
 *
 * See prog-strength-docs/sows/bodyweight-multi-per-day.md.
 */

const UNIT_PREFERENCE_KEY = "ps_bodyweight_unit";
const PAGE_SIZE = 20;

// Recharts series colors. Picked for clear hue contrast so the
// scatter (raw readings) doesn't blur into the line (daily-avg
// trend). Blue stays the "primary signal" reading for the trend,
// amber is the "secondary detail" reading for the raw scatter.
const COLOR_AVG = "#3b82f6"; // blue-500 — trend line
const COLOR_RAW = "#fcd34d"; // amber-300 — raw readings scatter

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
  const [showLog, setShowLog] = useState(false);

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

  const displayUnit: "lb" | "kg" = useMemo(() => {
    if (!entries || entries.length === 0) return "lb";
    return entries[0].unit;
  }, [entries]);

  const entriesInRange = useMemo(() => {
    if (!entries) return [];
    const sorted = [...entries].sort(
      (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
    );
    const rangeDef = RANGES.find((r) => r.key === range);
    if (!rangeDef || rangeDef.days === null) return sorted;
    const cutoffMs = Date.now() - rangeDef.days * 24 * 60 * 60 * 1000;
    return sorted.filter((e) => new Date(e.measured_at).getTime() >= cutoffMs);
  }, [entries, range]);

  const totalPages = Math.max(1, Math.ceil(entriesInRange.length / PAGE_SIZE));
  const pageEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return entriesInRange.slice(start, start + PAGE_SIZE);
  }, [entriesInRange, page]);

  useEffect(() => {
    setPage(1);
  }, [range]);

  // Returns a Promise so the modal can await + close itself on
  // success. Same pattern the nutrition page uses for QuickAddModal.
  function handleCreate(payload: {
    weight: number;
    unit: "lb" | "kg";
    measured_at?: string;
  }): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    setCreateBusy(true);
    setCreateError(null);
    return createBodyweightEntry(token, payload)
      .then(() => {
        refetch();
      })
      .catch((err: Error) => {
        setCreateError(err.message);
        throw err;
      })
      .finally(() => setCreateBusy(false));
  }

  function handleDelete(id: string) {
    if (
      !confirm("Delete this entry? Corrections are delete + re-add — the trend chart will update.")
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
          Multi-per-day OK — log morning + evening readings, the chart shows the daily-average trend
          through the spread.
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

          <ChartCard entries={entriesInRange} displayUnit={displayUnit} />

          <section className="flex flex-col gap-3">
            {/* Toolbar mirroring the nutrition page: ghost pencil-Log
                button above a white separator line, sitting directly
                above the entries table. */}
            <div className="flex items-center gap-5 border-b border-[var(--border)] pb-3">
              <ToolbarButton onClick={() => setShowLog(true)} icon={<PencilIcon />} label="Log" />
            </div>

            {entries === null && <p className="text-sm text-[var(--muted)]">Loading…</p>}
            {entries && entriesInRange.length === 0 && (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                {entries.length === 0
                  ? "No readings yet. Tap Log to add your first reading."
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

      {showLog && (
        <BodyweightLogModal
          busy={createBusy}
          error={createError}
          initialUnit={displayUnit}
          onSubmit={handleCreate}
          onClose={() => setShowLog(false)}
        />
      )}
    </main>
  );
}

// --- Time range tabs ----------------------------------------------

function TimeRangeTabs({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
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

// --- Chart card ----------------------------------------------------

/**
 * Single card holding the chart, its legend, and the stat tiles. The
 * tiles sit inside the same `bg-[var(--surface)]` box so the visual
 * hierarchy reads as "the chart and its summary numbers are one
 * unit" rather than two adjacent rows.
 */
function ChartCard({
  entries,
  displayUnit,
}: {
  entries: BodyweightEntry[];
  displayUnit: "lb" | "kg";
}) {
  const { rawPoints, avgPoints } = useMemo(() => {
    const raw = entries.map((e) => ({
      t: new Date(e.measured_at).getTime(),
      weight: convertWeight(e.weight, e.unit, displayUnit),
    }));
    const byDay = new Map<number, number[]>();
    for (const e of entries) {
      const d = new Date(e.measured_at);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const arr = byDay.get(dayStart) ?? [];
      arr.push(convertWeight(e.weight, e.unit, displayUnit));
      byDay.set(dayStart, arr);
    }
    const avg: { t: number; avg: number }[] = [];
    for (const [dayStart, weights] of byDay) {
      const dailyMean = weights.reduce((a, b) => a + b, 0) / weights.length;
      avg.push({ t: dayStart + 12 * 60 * 60 * 1000, avg: dailyMean });
    }
    avg.sort((a, b) => a.t - b.t);
    return { rawPoints: raw, avgPoints: avg };
  }, [entries, displayUnit]);

  const stats = useMemo(() => computeStats(entries, displayUnit), [entries, displayUnit]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No readings in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
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
                const v = typeof label === "number" ? label : Number(label);
                return new Date(v).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
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
              fill={COLOR_RAW}
              isAnimationActive={false}
            />
            <Line
              name="avg"
              data={avgPoints}
              type="monotone"
              dataKey="avg"
              stroke={COLOR_AVG}
              strokeWidth={2}
              dot={{ fill: COLOR_AVG, r: 3 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
        <Legend color={COLOR_AVG} label={`Daily avg (${displayUnit})`} />
        <Legend color={COLOR_RAW} label="Reading" scatter />
      </div>

      {/* Stat tiles wrapped inside the same card. Sits directly under
          the chart + legend so the four numbers read as a summary of
          the visualization above. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Average"
          value={stats.avg !== null ? `${formatNumber(stats.avg)} ${displayUnit}` : "—"}
          sublabel={
            stats.count > 0
              ? `${stats.count} reading${stats.count === 1 ? "" : "s"}`
              : "No readings"
          }
        />
        <StatTile
          label="Min"
          value={stats.min !== null ? `${formatNumber(stats.min.weight)} ${displayUnit}` : "—"}
          sublabel={stats.min !== null ? formatShortDate(stats.min.date) : "—"}
        />
        <StatTile
          label="Max"
          value={stats.max !== null ? `${formatNumber(stats.max.weight)} ${displayUnit}` : "—"}
          sublabel={stats.max !== null ? formatShortDate(stats.max.date) : "—"}
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
      </div>
    </div>
  );
}

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  // Tiles inside the chart card use a slightly different background
  // (page background vs surface) to inset them visually against the
  // chart's surface background — same depth-by-contrast trick the
  // nutrition meal sections use for entry rows.
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
      <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{sublabel}</p>
    </div>
  );
}

function Legend({ color, label, scatter }: { color: string; label: string; scatter?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {scatter ? (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <span aria-hidden className="inline-block h-0.5 w-5" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

// --- Toolbar bits --------------------------------------------------

// Ghost button, white-on-dark, matches the nutrition page's
// ToolbarButton verbatim. Duplicated here rather than extracted to a
// shared module so each page's local toolbar bits stay self-contained
// — extract when there's a third consumer.
function ToolbarButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70"
    >
      {icon}
      {label}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
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
            <tr key={e.id} className="border-b border-[var(--border)]/50 last:border-b-0">
              <td className="px-4 py-2 tabular-nums">{formatRowDate(e.measured_at)}</td>
              <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                {formatRowTime(e.measured_at)}
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {formatNumber(e.weight)} <span className="text-[var(--muted)]">{e.unit}</span>
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
        <PaginationBtn label="« First" disabled={page === 1} onClick={() => onPageChange(1)} />
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

// --- Log modal ----------------------------------------------------

/**
 * Modal wrapper around the bodyweight log form. Same modal shell the
 * nutrition QuickAddModal and macro-goals-modal use (centered card,
 * backdrop, escape-to-close, body scroll lock). Returns Promise from
 * `onSubmit` so the modal can dismiss itself on success.
 */
function BodyweightLogModal({
  busy,
  error,
  initialUnit,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  initialUnit: "lb" | "kg";
  onSubmit: (payload: { weight: number; unit: "lb" | "kg"; measured_at?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState("");
  // Persist the unit choice across visits so users who measure in kg
  // don't have to flip the toggle every morning. Seed from
  // initialUnit (most-recent reading's unit from the page) when the
  // localStorage value isn't set yet.
  const [unit, setUnit] = useState<"lb" | "kg">(() => {
    if (typeof window === "undefined") return initialUnit;
    const stored = window.localStorage.getItem(UNIT_PREFERENCE_KEY);
    return stored === "kg" || stored === "lb" ? stored : initialUnit;
  });
  const [measuredAtLocal, setMeasuredAtLocal] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UNIT_PREFERENCE_KEY, unit);
    }
  }, [unit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e: React.FormEvent) {
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
    try {
      await onSubmit({ weight: w, unit, measured_at });
      onClose();
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the
      // user can correct + retry without losing their input.
    }
  }

  const shownError = error ?? localError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bodyweight-log-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="bodyweight-log-modal-title" className="text-base font-semibold">
              Log a reading
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Multi-per-day is fine — log morning and evening separately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          <div className="flex gap-3">
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
                autoFocus
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                Unit
              </span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "lb" | "kg")}
                disabled={busy}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">When</span>
            <input
              type="datetime-local"
              value={measuredAtLocal}
              onChange={(e) => setMeasuredAtLocal(e.target.value)}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
            />
            <span className="text-[10px] text-[var(--muted)]">Leave blank to log right now.</span>
          </label>

          {shownError && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {shownError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Logging…" : "Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- helpers ------------------------------------------------------

const LB_PER_KG = 2.20462;

function convertWeight(weight: number, from: "lb" | "kg", to: "lb" | "kg"): number {
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

function computeStats(entries: BodyweightEntry[], displayUnit: "lb" | "kg"): Stats {
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
  const min = normalized.reduce((acc, w) => (w.weight < acc.weight ? w : acc), normalized[0]);
  const max = normalized.reduce((acc, w) => (w.weight > acc.weight ? w : acc), normalized[0]);

  const byDay = new Map<number, number[]>();
  for (const w of normalized) {
    const d = new Date(w.measured_at);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const arr = byDay.get(dayStart) ?? [];
    arr.push(w.weight);
    byDay.set(dayStart, arr);
  }
  const dayStartTimes = [...byDay.keys()].sort((a, b) => a - b);
  let delta: number | null = null;
  let deltaPercent: number | null = null;
  if (dayStartTimes.length >= 2) {
    const firstAvg = mean(byDay.get(dayStartTimes[0]) ?? []);
    const lastAvg = mean(byDay.get(dayStartTimes[dayStartTimes.length - 1]) ?? []);
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

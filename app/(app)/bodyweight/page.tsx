"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
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
 * Bodyweight — scale-reading trend + quick entry form.
 *
 * Recharts line chart at the top with two series: raw entries
 * (solid) and a 7-day rolling average (dashed) computed client-side
 * from the same data. The rolling line is the load-bearing signal —
 * scale weight fluctuates daily by 2-4 lb from water and food, so
 * a single reading is noisy; the average is what a lifter tracks.
 *
 * Below the chart: an inline form (weight + unit + optional
 * measured-at) and the recent-entries list with delete buttons.
 * No edit — corrections are delete + re-create per the SOW so the
 * trend chart's audit trail stays clean.
 */

const UNIT_PREFERENCE_KEY = "ps_bodyweight_unit";

export default function BodyweightPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<BodyweightEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);

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
    if (!confirm("Delete this entry? Corrections are delete + re-add — the trend chart will update.")) {
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
          Scale readings over time. The dashed line is the 7-day rolling
          average — a cleaner signal than the daily noise.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <Chart entries={entries ?? []} />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Log a reading</h2>
            <EntryForm
              busy={createBusy}
              error={createError}
              onSubmit={handleCreate}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Recent entries</h2>

            {entries === null && (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            )}

            {entries && entries.length === 0 && (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                No readings yet. Log your morning weight above and come back
                tomorrow.
              </p>
            )}

            {entries && entries.length > 0 && (
              <ul className="flex flex-col gap-2">
                {entries.map((e) => (
                  <li key={e.id}>
                    <EntryRow
                      entry={e}
                      busy={rowBusyID === e.id}
                      onDelete={() => handleDelete(e.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// --- Chart --------------------------------------------------------

function Chart({ entries }: { entries: BodyweightEntry[] }) {
  // Build the chart series in chronological order with a 7-day
  // rolling average over the raw points. Mixed units in the same
  // window would make the average meaningless; the data prep below
  // doesn't try to convert (a single-user beta tends to be unit-
  // consistent anyway). The Y-axis label takes the most-recent
  // entry's unit so the axis label matches what the user sees in
  // the form.
  const series = useMemo(() => {
    const asc = [...entries].sort(
      (a, b) =>
        new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return asc.map((e, i) => {
      const t = new Date(e.measured_at).getTime();
      // Rolling average: every point within [t - 7 days, t]. Includes
      // the current point so the very first reading has a meaningful
      // average value (itself).
      const windowStart = t - sevenDaysMs;
      let sum = 0;
      let count = 0;
      for (let j = i; j >= 0; j--) {
        const tj = new Date(asc[j].measured_at).getTime();
        if (tj < windowStart) break;
        sum += asc[j].weight;
        count++;
      }
      return {
        t,
        weight: e.weight,
        avg: count > 0 ? sum / count : null,
        unit: e.unit,
      };
    });
  }, [entries]);

  const axisUnit = entries.length > 0 ? entries[0].unit : "lb";

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        Log a reading to start the trend.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
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
              // Recharts' Formatter type widens value/name to unknowns,
              // so we coerce here rather than fight the generics. The
              // values we feed the chart are always numbers and the
              // dataKeys are always "weight" or "avg".
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                return [
                  `${formatNumber(v)} ${axisUnit}`,
                  name === "weight" ? "Reading" : "7-day avg",
                ];
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 3 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#a1a1aa"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
        <Legend color="#3b82f6" label={`Reading (${axisUnit})`} />
        <Legend color="#a1a1aa" label="7-day average" dashed />
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block h-0.5 w-5 ${dashed ? "border-t border-dashed" : ""}`}
        style={{ backgroundColor: dashed ? "transparent" : color, borderColor: color }}
      />
      {label}
    </span>
  );
}

// --- Entry form ---------------------------------------------------

function EntryForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (payload: { weight: number; unit: "lb" | "kg"; measured_at?: string }) => void;
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

  // Mirror unit changes back to localStorage. Write-side effect only;
  // safe under the same lint rule because there's no setState here.
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
    // datetime-local input value is a local-time string with no zone
    // ("2026-05-29T07:30"). Convert via the Date constructor, which
    // interprets it in the user's local zone, then send UTC.
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
        <p className="w-full text-xs text-[var(--danger)] sm:ml-3">{shownError}</p>
      )}
    </form>
  );
}

// --- List row ----------------------------------------------------

function EntryRow({
  entry,
  busy,
  onDelete,
}: {
  entry: BodyweightEntry;
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-sm font-medium tabular-nums">
          {formatNumber(entry.weight)} {entry.unit}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatDateTime(entry.measured_at)}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

// --- helpers ------------------------------------------------------

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

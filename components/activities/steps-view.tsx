"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteStepsForDate,
  getStepsGoal,
  listSteps,
  putStepsGoal,
  upsertStepsForDate,
  type StepsEntry,
  type StepsGoal,
} from "@/lib/api";
import { StatTile } from "@/components/stat-tile";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_LIFT_LINE,
  CHART_STEPS_MET,
  CHART_STEPS_UNDER,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_RADIUS,
} from "@/lib/chart-colors";

const PAGE_SIZE = 25;
const MAX_STEPS = 200000;

/**
 * Steps sub-view of the Activities page. Top → bottom:
 *   - Stat tiles (avg / total / best day / goal attainment) over the
 *     selected timeframe window.
 *   - Daily bar chart, one bar per day in the range. When a goal is
 *     set, days that met/over the goal read in the calm success tone and
 *     under-goal days in a muted neutral, against a dashed goal line;
 *     with no goal set every bar reads in the calm periwinkle accent.
 *   - A keyset-paginated log table (one row per day) with Log / Edit /
 *     Delete affordances and a "Set steps goal" control.
 *
 * The chart + tiles read the `days` window (range fetch); the log table
 * paginates independently of the window via keyset cursors. Both refetch
 * after any mutation so the view reflects the saved value immediately.
 */
export function StepsView({ days }: { days: number | null }) {
  const router = useRouter();

  // Range-windowed entries powering the tiles + chart.
  const [rangeEntries, setRangeEntries] = useState<StepsEntry[] | null>(null);
  // Keyset-paginated entries powering the log table.
  const [logEntries, setLogEntries] = useState<StepsEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [goal, setGoal] = useState<StepsGoal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showLog, setShowLog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StepsEntry | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const handleAuthError = useCallback(
    (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router],
  );

  // Range fetch (tiles + chart) + goal + first keyset page of the log
  // table. Reused on mount, on `days` change, and after any mutation.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const since = days !== null ? isoDate(new Date(Date.now() - (days - 1) * DAY_MS)) : undefined;
    const until = days !== null ? isoDate(new Date()) : undefined;
    Promise.all([
      listSteps(token, { since, until }),
      getStepsGoal(token),
      listSteps(token, { limit: PAGE_SIZE }),
    ])
      .then(([range, g, firstPage]) => {
        setError(null);
        setRangeEntries(range.steps);
        setGoal(g);
        setLogEntries(firstPage.steps);
        setNextBefore(firstPage.next_before);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load steps");
      });
  }, [router, handleAuthError, days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function loadMore() {
    const token = getToken();
    if (!token || !nextBefore) {
      if (!token) router.replace("/login");
      return;
    }
    setLoadingMore(true);
    listSteps(token, { limit: PAGE_SIZE, before: nextBefore })
      .then((page) => {
        setLogEntries((prev) => [...(prev ?? []), ...page.steps]);
        setNextBefore(page.next_before);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load more steps");
      })
      .finally(() => setLoadingMore(false));
  }

  function handleSave(date: string, steps: number): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    return upsertStepsForDate(token, date, steps).then(() => {
      refetch();
    });
  }

  function handleDelete(date: string): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    return deleteStepsForDate(token, date).then(() => {
      refetch();
    });
  }

  function handleSaveGoal(value: number): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    return putStepsGoal(token, { goal: value }).then((saved) => {
      setGoal(saved);
      setShowGoalModal(false);
    });
  }

  const hasGoal = goal !== null && goal.goal > 0;
  const goalValue = hasGoal ? goal.goal : null;

  const stats = useMemo(() => computeStats(rangeEntries ?? []), [rangeEntries]);

  // Chart data oldest → newest so the bars read left-to-right in time.
  const chartData = useMemo(() => {
    const sorted = [...(rangeEntries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((e) => ({ date: e.date, steps: e.steps }));
  }, [rangeEntries]);

  const attainment =
    goalValue && goalValue > 0 && stats.avg !== null
      ? Math.round((stats.avg / goalValue) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {rangeEntries === null && !error && (
        <p className="text-sm text-[var(--muted)]">Loading steps…</p>
      )}

      {rangeEntries !== null && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              value={stats.avg !== null ? formatSteps(Math.round(stats.avg)) : "—"}
              label="Avg daily steps"
            />
            <StatTile value={formatSteps(stats.total)} label="Total steps" />
            <StatTile
              value={stats.best !== null ? formatSteps(stats.best.steps) : "—"}
              label="Best day"
              sub={stats.best !== null ? formatShortDate(stats.best.date) : undefined}
            />
            <StatTile
              value={hasGoal ? formatSteps(goalValue as number) : "— — —"}
              label="Goal"
              sub={
                hasGoal
                  ? attainment !== null
                    ? `${attainment}% of ${formatSteps(goalValue as number)}`
                    : "Not enough data"
                  : "Not set"
              }
              tone={
                hasGoal && attainment !== null
                  ? attainment >= 100
                    ? "positive"
                    : "neutral"
                  : "neutral"
              }
            />
          </div>

          <ChartCard data={chartData} goal={goalValue} />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <ToolbarButton
                onClick={() => setShowLog(true)}
                icon={<PencilIcon />}
                label="Log steps"
              />
              <GoalAffordance goal={goalValue} onClick={() => setShowGoalModal(true)} />
            </div>

            {logEntries !== null && logEntries.length === 0 ? (
              <EmptyState onLog={() => setShowLog(true)} />
            ) : (
              <StepsTable
                entries={logEntries ?? []}
                onEdit={(e) => setEditingEntry(e)}
                onDelete={(date) => handleDelete(date)}
                hasMore={nextBefore !== null}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
              />
            )}
          </section>
        </>
      )}

      {showLog && <StepsLogModal onSubmit={handleSave} onClose={() => setShowLog(false)} />}

      {editingEntry && (
        <StepsLogModal
          entry={editingEntry}
          onSubmit={handleSave}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {showGoalModal && (
        <StepsGoalModal
          goal={goalValue}
          onSubmit={handleSaveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </div>
  );
}

// --- Chart card ----------------------------------------------------

function ChartCard({
  data,
  goal,
}: {
  data: { date: string; steps: number }[];
  goal: number | null;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No steps logged in this range.
      </div>
    );
  }

  // Day-by-day bar tone: with no goal the whole chart reads calm
  // periwinkle; with a goal, met/over days read success and under days a
  // muted neutral so attainment is visible at a glance against the line.
  const barColor = (steps: number) =>
    goal === null ? CHART_LIFT_LINE : steps >= goal ? CHART_STEPS_MET : CHART_STEPS_UNDER;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <h3 className="text-base font-semibold tracking-tight">Daily steps</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke={CHART_AXIS}
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              minTickGap={16}
              tickFormatter={(v: string) => formatAxisDate(v)}
            />
            <YAxis
              stroke={CHART_AXIS}
              tick={{ fill: CHART_AXIS, fontSize: 11 }}
              width={48}
              // Force the goal into the visible domain so its reference
              // line never clips off-axis (mirrors the bodyweight fix).
              domain={[
                (dataMin: number) => Math.floor(goal !== null ? Math.min(dataMin, goal) : dataMin),
                (dataMax: number) => Math.ceil(goal !== null ? Math.max(dataMax, goal) : dataMax),
              ]}
              tickFormatter={(v: number) => formatSteps(Math.round(v))}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: CHART_TOOLTIP_BG,
                border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                borderRadius: CHART_TOOLTIP_RADIUS,
                padding: "8px 10px",
                fontSize: "12px",
              }}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(label) => formatTooltipDate(String(label))}
              formatter={(value) => {
                const v = typeof value === "number" ? value : Number(value);
                return [formatSteps(v), "Steps"];
              }}
            />
            <Bar dataKey="steps" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.date} fill={barColor(d.steps)} />
              ))}
            </Bar>
            {goal !== null && (
              <ReferenceLine
                y={goal}
                stroke={CHART_STEPS_MET}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Goal ${formatSteps(goal)}`,
                  position: "right",
                  fill: CHART_STEPS_MET,
                  fontSize: 10,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Table --------------------------------------------------------

function StepsTable({
  entries,
  onEdit,
  onDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  entries: StepsEntry[];
  onEdit: (entry: StepsEntry) => void;
  onDelete: (date: string) => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-right">Steps</th>
            <th className="px-4 py-2 text-right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-[var(--border)]/50 last:border-b-0">
              <td className="px-4 py-2 tabular-nums">{formatRowDate(e.date)}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {formatSteps(e.steps)}
              </td>
              <td className="px-4 py-2 text-right">
                <div className="inline-flex items-center gap-1">
                  <IconButton aria-label="Edit steps" tone="muted" onClick={() => onEdit(e)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Delete steps"
                    tone="danger"
                    onClick={() => {
                      void onDelete(e.date);
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasMore && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs hover:opacity-80 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onLog }: { onLog: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No steps logged yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[var(--muted)]">
        Track your daily step count to see trends against your goal.
      </p>
      <button
        type="button"
        onClick={onLog}
        className="mt-4 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80"
      >
        Log steps
      </button>
    </div>
  );
}

// --- Log / Edit modal ---------------------------------------------

/**
 * Modal to log or edit a day's steps. When `entry` is passed it
 * pre-fills that row's date + steps for editing; otherwise it defaults
 * to today with an empty count. Shares the bodyweight modal shell
 * (centered card, backdrop, escape-to-close, body scroll lock).
 */
function StepsLogModal({
  entry,
  onSubmit,
  onClose,
}: {
  entry?: StepsEntry;
  onSubmit: (date: string, steps: number) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(entry ? entry.date : isoDate(new Date()));
  const [steps, setSteps] = useState(entry ? String(entry.steps) : "");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    if (!date) {
      setLocalError("Date is required.");
      return;
    }
    const n = Number(steps);
    if (!Number.isInteger(n) || n < 0) {
      setLocalError("Steps must be a non-negative whole number.");
      return;
    }
    if (n > MAX_STEPS) {
      setLocalError(`Steps must be ${formatSteps(MAX_STEPS)} or fewer.`);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(date, n);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      titleId="steps-log-modal-title"
      title={entry ? "Edit steps" : "Log steps"}
      subtitle="Re-logging a day overwrites its previous count."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy || entry !== undefined}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
              Steps
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="10000"
              disabled={busy}
              autoFocus
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>

        {localError && (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {localError}
          </div>
        )}

        <ModalFooter busy={busy} onClose={onClose} submitLabel={busy ? "Saving…" : "Save"} />
      </form>
    </ModalShell>
  );
}

// --- Goal modal ---------------------------------------------------

function StepsGoalModal({
  goal,
  onSubmit,
  onClose,
}: {
  goal: number | null;
  onSubmit: (goal: number) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(goal ? String(goal) : "");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      setLocalError("Goal must be a positive whole number.");
      return;
    }
    if (n > MAX_STEPS) {
      setLocalError(`Goal must be ${formatSteps(MAX_STEPS)} or fewer.`);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(n);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      titleId="steps-goal-modal-title"
      title={goal ? "Edit steps goal" : "Set steps goal"}
      subtitle="Your daily target — it shows as a reference line on the chart."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
            Daily goal
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="10000"
            disabled={busy}
            autoFocus
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
          />
        </label>

        {localError && (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {localError}
          </div>
        )}

        <ModalFooter busy={busy} onClose={onClose} submitLabel={busy ? "Saving…" : "Save"} />
      </form>
    </ModalShell>
  );
}

// --- Modal shell --------------------------------------------------

function ModalShell({
  titleId,
  title,
  subtitle,
  busy,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  subtitle: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <p className="text-xs text-[var(--muted)]">{subtitle}</p>
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
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  busy,
  onClose,
  submitLabel,
}: {
  busy: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
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
        {submitLabel}
      </button>
    </div>
  );
}

// --- Toolbar bits --------------------------------------------------

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

function GoalAffordance({ goal, onClick }: { goal: number | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={goal ? `Goal ${formatSteps(goal)} steps — tap to edit` : "Set steps goal"}
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm transition hover:bg-white/5"
    >
      <TargetIcon />
      <span className="hidden text-[var(--muted)] sm:inline">Goal:</span>
      {goal ? (
        <span className="font-semibold tabular-nums">{formatSteps(goal)}</span>
      ) : (
        <span className="italic text-[var(--muted)]">Set steps goal</span>
      )}
    </button>
  );
}

function IconButton({
  tone,
  onClick,
  "aria-label": ariaLabel,
  children,
}: {
  tone: "muted" | "danger";
  onClick: () => void;
  "aria-label": string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--danger)] hover:text-[var(--danger)]"
      : "text-[var(--muted)] hover:text-[var(--foreground)]";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded p-1 transition hover:bg-white/5 ${toneClass}`}
    >
      {children}
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-[var(--success)]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

// --- helpers ------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

type StepsStats = {
  avg: number | null;
  total: number;
  best: { date: string; steps: number } | null;
};

function computeStats(entries: StepsEntry[]): StepsStats {
  if (entries.length === 0) return { avg: null, total: 0, best: null };
  let total = 0;
  let best = entries[0];
  for (const e of entries) {
    total += e.steps;
    if (e.steps > best.steps) best = e;
  }
  return {
    avg: total / entries.length,
    total,
    best: { date: best.date, steps: best.steps },
  };
}

/** Local-time YYYY-MM-DD for a Date, matching the date-keyed log. */
function isoDate(d: Date): string {
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}`;
}

function formatSteps(n: number): string {
  return n.toLocaleString();
}

// A YYYY-MM-DD string parsed as local time (not UTC), so the displayed
// day matches the date key the user logged.
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatAxisDate(date: string): string {
  const d = parseLocalDate(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTooltipDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRowDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

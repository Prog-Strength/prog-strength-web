"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { StepsLogAccordion } from "@/components/activities/steps-log-accordion";
import { bucketByWeek, WEEKS_PER_PAGE } from "@/lib/steps-grouping";
import {
  buildAxis,
  deriveStats,
  isoDate,
  parseLocalDate,
  rangeSinceIso,
  type Day,
} from "@/lib/steps-stats";
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
 * Steps sub-view of the Activities page, built in the goal-ring-hero idiom:
 * goal attainment is the hero. Top → bottom:
 *   - A hero progress ring: the period average sits in its center, the ring
 *     fills toward the goal in the periwinkle accent and clears to
 *     success-green once at/over goal. With no goal it's a calm neutral track.
 *   - A supporting Days-hit / Best / Total strip, so the average reads as the
 *     headline rather than one of four equal tiles.
 *   - A goal-relative bar chart: a muted base climbs to the goal line and a
 *     success crest tops days that clear it; unlogged days are gaps (never
 *     0-step bars). With no goal every bar reads in the calm accent.
 *   - A week-accordion log: collapsible Mon–Sun sections with week summaries,
 *     four weeks per page, and day ring-rows with Log / Edit / Delete inside
 *     an expanded week.
 *
 * The ring + strip + bars read the `days` window (range fetch); the log
 * paginates independently of the window via keyset cursors. Both refetch after
 * any mutation so the view reflects the saved value immediately. Everything the
 * view shows is derived client-side (`lib/steps-stats`) from the existing
 * `listSteps` / `getStepsGoal` endpoints — there is no steps-specific backend.
 */
export function StepsView({ days }: { days: number | null }) {
  const router = useRouter();

  // Range-windowed entries powering the ring + strip + chart.
  const [rangeEntries, setRangeEntries] = useState<StepsEntry[] | null>(null);
  // Keyset-paginated entries powering the week accordion.
  const [logEntries, setLogEntries] = useState<StepsEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [weekPage, setWeekPage] = useState(0);
  const [accordionResetKey, setAccordionResetKey] = useState(0);
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

  // Range fetch (ring + strip + chart) + goal + first keyset page of the log
  // accordion. Reused on mount, on `days` change, and after any mutation.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const since = days !== null ? rangeSinceIso(days) : undefined;
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
        setWeekPage(0);
        setAccordionResetKey((k) => k + 1);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load steps");
      });
  }, [router, handleAuthError, days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const hasGoal = goal !== null && goal.goal > 0;
  const goalValue = hasGoal ? goal.goal : null;

  const weeks = useMemo(() => bucketByWeek(logEntries ?? [], goalValue), [logEntries, goalValue]);
  const pageCount = Math.max(1, Math.ceil(weeks.length / WEEKS_PER_PAGE));
  const showPager = pageCount > 1 || nextBefore !== null;
  const canGoOlder =
    weekPage < pageCount - 1 || (weekPage === pageCount - 1 && nextBefore !== null);

  useEffect(() => {
    if (logEntries === null || loadingMore) return;
    if (weeks.length > weekPage * WEEKS_PER_PAGE || nextBefore === null) return;

    const token = getToken();
    if (!token) {
      router.replace("/login");
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
  }, [logEntries, loadingMore, weekPage, weeks.length, nextBefore, router, handleAuthError]);

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
      refetch();
    });
  }

  const stats = useMemo(
    () => deriveStats(rangeEntries ?? [], days, goalValue ?? 0),
    [rangeEntries, days, goalValue],
  );
  const axis = useMemo(
    () => buildAxis(rangeEntries ?? [], days, goalValue ?? 0),
    [rangeEntries, days, goalValue],
  );

  const fullyEmpty =
    rangeEntries !== null &&
    rangeEntries.length === 0 &&
    logEntries !== null &&
    logEntries.length === 0;

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

      {rangeEntries !== null &&
        (fullyEmpty ? (
          <EmptyRing onLog={() => setShowLog(true)} />
        ) : (
          <>
            <HeroRing
              avg={stats.avg}
              attainmentPct={stats.attainmentPct}
              hasGoal={hasGoal}
              goal={goalValue}
              daysHit={stats.daysHit}
              daysLogged={stats.daysLogged}
              best={stats.best}
              total={stats.total}
            />

            <RelativeBars axis={axis} goal={goalValue} />

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
                <StepsLogAccordion
                  entries={logEntries ?? []}
                  goal={goalValue}
                  onEdit={(e) => setEditingEntry(e)}
                  onDelete={(date) => handleDelete(date)}
                  weekPage={weekPage}
                  onWeekPageChange={setWeekPage}
                  pageCount={pageCount}
                  showPager={showPager}
                  canGoOlder={canGoOlder}
                  loadingMore={loadingMore}
                  resetKey={accordionResetKey}
                />
              )}
            </section>
          </>
        ))}

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

// --- Hero ring + supporting strip ----------------------------------

function HeroRing({
  avg,
  attainmentPct,
  hasGoal,
  goal,
  daysHit,
  daysLogged,
  best,
  total,
}: {
  avg: number | null;
  attainmentPct: number | null;
  hasGoal: boolean;
  goal: number | null;
  daysHit: number;
  daysLogged: number;
  best: { date: string; steps: number } | null;
  total: number;
}) {
  // No entries in the selected window (but data exists outside it): a calm
  // neutral ring with a plain caption, no NaN%, no broken frame.
  if (avg === null) {
    return (
      <div className="flex flex-col items-center gap-2 pt-2">
        <Ring pct={null} center="—" cleared={false} />
        <p className="text-center text-[13px] text-[var(--muted)]">No steps in this range</p>
      </div>
    );
  }

  const pct = hasGoal ? attainmentPct : null;
  const cleared = pct !== null && pct >= 100;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2 pt-2">
        <Ring pct={pct} center={formatSteps(Math.round(avg))} cleared={cleared} />
        <p className="text-center text-[13px] text-[var(--muted)]">
          {hasGoal && pct !== null ? (
            <>
              avg / day —{" "}
              <span style={{ color: cleared ? "var(--success)" : "var(--accent)" }}>
                {pct}% of {formatSteps(goal as number)} goal
              </span>
            </>
          ) : (
            <>avg / day — no goal set</>
          )}
        </p>
      </div>

      <div className="flex w-full max-w-sm items-stretch justify-center gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] text-center">
        <MiniStat
          label="Days hit"
          value={hasGoal ? `${daysHit}/${daysLogged}` : "—"}
          tone={hasGoal ? "success" : "muted"}
        />
        <MiniStat label="Best" value={best ? fmtK(best.steps) : "—"} />
        <MiniStat label="Total" value={fmtK(total)} />
      </div>
    </div>
  );
}

/** The hero ring. The accent fills progress; it clears to success once at/over
 * goal. No goal (pct null) ⇒ a calm neutral track with the value centered. */
function Ring({ pct, center, cleared }: { pct: number | null; center: string; cleared: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  const stroke = cleared ? "var(--success)" : "var(--accent)";
  return (
    <div className="relative grid h-[148px] w-[148px] place-items-center sm:h-[180px] sm:w-[180px]">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        {pct !== null && (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          data-testid="hero-average"
          className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[42px]"
        >
          {center}
        </span>
        {pct !== null && (
          <span
            className="mt-1 text-[12px] font-semibold tabular-nums"
            style={{ color: cleared ? "var(--success)" : "var(--accent)" }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "muted";
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "muted" ? "var(--faint)" : "var(--foreground)";
  return (
    <div className="flex-1 bg-[var(--background)] px-3 py-3">
      <div className="text-[16px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

// --- Goal-relative bars --------------------------------------------

type BarDatum = {
  date: string;
  base: number | null; // min(steps, goal) — the muted climb to the line
  crest: number | null; // max(0, steps − goal) — the success topping
  steps: number | null; // raw steps (no goal) / for the tooltip
};

/**
 * Goal-relative daily bars. With a goal, each day is a stacked muted base
 * (`min(steps, goal)`) plus a success crest (`max(0, steps − goal)`) read
 * against the dashed goal line; unlogged days carry no value so recharts
 * renders them as gaps, not 0-step bars. With no goal, every bar reads in the
 * calm accent. The goal is forced into the Y domain so its line never clips and
 * one big day can't flatten the rest.
 */
function RelativeBars({ axis, goal }: { axis: Day[]; goal: number | null }) {
  if (axis.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No steps logged in this range.
      </div>
    );
  }

  const data: BarDatum[] = axis.map((d) => {
    if (d.steps === null) return { date: d.date, base: null, crest: null, steps: null };
    if (goal === null) return { date: d.date, base: null, crest: null, steps: d.steps };
    return {
      date: d.date,
      base: Math.min(d.steps, goal),
      crest: Math.max(0, d.steps - goal),
      steps: d.steps,
    };
  });

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
              // Force the goal into the visible domain so its reference line
              // never clips off-axis (mirrors the bodyweight fix).
              domain={[
                0,
                (dataMax: number) => Math.ceil(goal !== null ? Math.max(dataMax, goal) : dataMax),
              ]}
              tickFormatter={(v: number) => formatSteps(Math.round(v))}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              wrapperStyle={{ outline: "none" }}
              content={<BarsTooltip />}
            />
            {goal === null ? (
              <Bar
                dataKey="steps"
                fill={CHART_LIFT_LINE}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            ) : (
              <>
                <Bar
                  dataKey="base"
                  stackId="steps"
                  fill={CHART_STEPS_UNDER}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="crest"
                  stackId="steps"
                  fill={CHART_STEPS_MET}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              </>
            )}
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

/** Tooltip showing the day's total steps (the stacked base + crest summed), so
 * the goal-relative split never reads as two separate numbers. */
function BarsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: BarDatum }[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum || datum.steps === null) return null;
  return (
    <div
      style={{
        backgroundColor: CHART_TOOLTIP_BG,
        border: `1px solid ${CHART_TOOLTIP_BORDER}`,
        borderRadius: CHART_TOOLTIP_RADIUS,
        padding: "8px 10px",
        fontSize: "12px",
      }}
    >
      <div className="text-[var(--muted)]">{formatTooltipDate(String(label))}</div>
      <div className="font-semibold tabular-nums">{formatSteps(datum.steps)} steps</div>
    </div>
  );
}

// --- Log accordion (day rows live in steps-log-accordion.tsx) ------------

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

/** The empty / first-entry start state: a calm neutral ring with a coaching
 * caption ("your ring fills as you log") and a Log-steps CTA — no broken chart
 * frame. */
function EmptyRing({ onLog }: { onLog: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="grid h-[148px] w-[148px] place-items-center">
        <svg viewBox="0 0 128 128" className="h-full w-full" aria-hidden="true">
          <circle cx="64" cy="64" r="52" fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        </svg>
      </div>
      <p className="max-w-[34ch] text-sm text-[var(--muted)]">
        No steps yet — your ring fills as you log days against your goal.
      </p>
      <button
        type="button"
        onClick={onLog}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-80"
      >
        <PencilIcon /> Log steps
      </button>
    </div>
  );
}

// --- Log / Edit modal ---------------------------------------------

/**
 * Modal to log or edit a day's steps. When `entry` is passed it pre-fills that
 * row's date + steps for editing; otherwise it defaults to today with an empty
 * count. Shares the bodyweight modal shell (centered card, backdrop,
 * escape-to-close, body scroll lock).
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

function formatSteps(n: number): string {
  return n.toLocaleString();
}

/** Compact "9.4k" form for the tight supporting-stat chips. */
function fmtK(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
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

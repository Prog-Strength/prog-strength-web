"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  createBodyweightEntry,
  deleteBodyweightEntry,
  getBodyweightGoal,
  listBodyweight,
  putBodyweightGoal,
  updateBodyweightEntry,
  type BodyweightEntry,
  type BodyweightGoal,
} from "@/lib/api";
import { BodyweightActionSheet } from "@/components/bodyweight/bodyweight-action-sheet";
import { BodyweightReadingsTimeline } from "@/components/bodyweight/bodyweight-readings-timeline";
import { TrendSection } from "./_components/trend-section";

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

type RangeKey = "30" | "60" | "90" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30", label: "30 days", days: 30 },
  { key: "60", label: "60 days", days: 60 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All", days: null },
];

export default function BodyweightPage() {
  const router = useRouter();
  // Subscribed to Tailwind's sm: breakpoint (640px) via matchMedia.
  // Drives the chart's responsive y-axis width + goal-label position
  // and the table↔card layout swap below sm:. Hook plumbing sits at
  // module scope below — same pattern as components/date-tile-strip.tsx.
  const isMobile = useSyncExternalStore(
    subscribeMobileQuery,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );
  const [entries, setEntries] = useState<BodyweightEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<BodyweightEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<BodyweightEntry | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("30");
  const [showLog, setShowLog] = useState(false);
  const [goal, setGoal] = useState<BodyweightGoal | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  // Mobile action sheet target. When set, tapping a row card on mobile
  // opens BodyweightActionSheet, which then routes to the existing
  // edit / delete modals. Desktop never sets this — the row's pencil
  // and trash icons fire onEdit / onDelete directly.
  const [actionTarget, setActionTarget] = useState<BodyweightEntry | null>(null);

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

  const refetchGoal = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getBodyweightGoal(token)
      .then(setGoal)
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
    refetchGoal();
  }, [refetch, refetchGoal]);

  // A goal counts as "set" only when it has a positive weight and a
  // server-assigned created_at; the empty-state shape (weight 0 /
  // created_at null) from getBodyweightGoal means "no goal yet".
  const hasGoal = goal !== null && goal.weight > 0 && goal.created_at !== null;

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

  // Returns a Promise so the goal modal can await + close on success,
  // mirroring handleCreate. Re-reads the goal afterwards so the
  // affordance + chart reflect the saved value immediately.
  function handleSaveGoal(payload: { weight: number; unit: "lb" | "kg" }): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    setGoalBusy(true);
    setGoalError(null);
    return putBodyweightGoal(token, payload)
      .then((saved) => {
        setGoal(saved);
        setShowGoalModal(false);
        setGoalError(null);
      })
      .catch((err: Error) => {
        setGoalError(err.message);
        throw err;
      })
      .finally(() => setGoalBusy(false));
  }

  // Edits an existing reading. Returns a Promise so the edit modal can
  // await + close itself on success (parent clears state here on the
  // happy path); on failure the error surfaces and the modal stays open.
  function handleEditSubmit(payload: {
    weight: number;
    unit: "lb" | "kg";
    measured_at: string;
  }): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    if (!editingEntry) return Promise.reject(new Error("no entry selected"));
    setEditBusy(true);
    setEditError(null);
    return updateBodyweightEntry(token, editingEntry.id, payload)
      .then(() => {
        setEditingEntry(null);
        setEditError(null);
        refetch();
      })
      .catch((err: Error) => {
        setEditError(err.message);
        throw err;
      })
      .finally(() => setEditBusy(false));
  }

  // Confirms deletion of a reading. Same Promise contract as
  // handleEditSubmit so the confirmation modal can await the result.
  function handleDeleteConfirm(): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    if (!deletingEntry) return Promise.reject(new Error("no entry selected"));
    setDeleteBusy(true);
    setDeleteError(null);
    return deleteBodyweightEntry(token, deletingEntry.id)
      .then(() => {
        setDeletingEntry(null);
        setDeleteError(null);
        refetch();
      })
      .catch((err: Error) => {
        setDeleteError(err.message);
        throw err;
      })
      .finally(() => setDeleteBusy(false));
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Bodyweight</h1>
        <p className="text-xs text-[var(--muted)]">
          Multi-per-day OK — log morning + evening readings, the chart shows the daily-average trend
          through the spread.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <TimeRangeTabs
            value={range}
            onChange={setRange}
            count={entriesInRange.length}
            endingLabel={
              entriesInRange.length > 0
                ? new Date(entriesInRange[0].measured_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : null
            }
          />

          <TrendSection
            entries={entriesInRange}
            displayUnit={displayUnit}
            goal={hasGoal ? goal : null}
            isMobile={isMobile}
          />

          <section className="flex flex-col gap-3">
            {/* Toolbar mirroring the nutrition page: ghost pencil-Log
                button above a white separator line, sitting directly
                above the entries table. */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <ToolbarButton onClick={() => setShowLog(true)} icon={<PencilIcon />} label="Log" />
              <GoalAffordance goal={hasGoal ? goal : null} onClick={() => setShowGoalModal(true)} />
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
              <BodyweightReadingsTimeline
                entries={entriesInRange}
                displayUnit={displayUnit}
                onEdit={(entry) => setEditingEntry(entry)}
                onDelete={(entry) => setDeletingEntry(entry)}
                onTapReading={(entry) => setActionTarget(entry)}
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

      {showGoalModal && (
        <BodyweightGoalModal
          busy={goalBusy}
          error={goalError}
          goal={hasGoal ? goal : null}
          onSubmit={handleSaveGoal}
          onClose={() => {
            setShowGoalModal(false);
            setGoalError(null);
          }}
        />
      )}

      {editingEntry && (
        <BodyweightEditModal
          entry={editingEntry}
          busy={editBusy}
          error={editError}
          onSubmit={handleEditSubmit}
          onClose={() => {
            setEditingEntry(null);
            setEditError(null);
          }}
        />
      )}

      {deletingEntry && (
        <BodyweightDeleteModal
          entry={deletingEntry}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onClose={() => {
            setDeletingEntry(null);
            setDeleteError(null);
          }}
        />
      )}

      {actionTarget && (
        <BodyweightActionSheet
          entry={actionTarget}
          onEdit={() => {
            const target = actionTarget;
            setActionTarget(null);
            setEditingEntry(target);
          }}
          onDelete={() => {
            const target = actionTarget;
            setActionTarget(null);
            setDeletingEntry(target);
          }}
          onClose={() => setActionTarget(null)}
        />
      )}
    </main>
  );
}

// --- Time range tabs ----------------------------------------------

function TimeRangeTabs({
  value,
  onChange,
  count,
  endingLabel,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
  count: number;
  endingLabel: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGES.map((r) => {
          const selected = r.key === value;
          // Quiet pills — the chart is the headline. Active = accent-soft
          // fill + accent-line border + accent text, per the design system.
          const stateClasses = selected
            ? "bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent)]"
            : "border border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]";
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onChange(r.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${stateClasses}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      {count > 0 && endingLabel !== null && (
        <span className="text-xs text-[var(--muted)]">
          {count} reading{count === 1 ? "" : "s"} · ending {endingLabel}
        </span>
      )}
    </div>
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

// Right-justified twin of the Log button on the toolbar separator. A
// plain (outline-free) button: a green target icon, the muted "Goal:"
// label, then either an italic "Set goal weight" call-to-action when no
// goal is set or the bold goal value when one is.
function GoalAffordance({ goal, onClick }: { goal: BodyweightGoal | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        goal ? `Goal ${formatNumber(goal.weight)} ${goal.unit} — tap to edit` : "Set goal weight"
      }
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm transition hover:bg-white/5"
    >
      <TargetIcon />
      {/* "Goal:" prefix hides on mobile so the target icon + value
          alone fit comfortably next to the Log button on a phone-width
          toolbar. The aria-label preserves the full phrase. */}
      <span className="hidden text-[var(--muted)] sm:inline">Goal:</span>
      {goal ? (
        <span className="font-semibold tabular-nums">
          {formatNumber(goal.weight)} {goal.unit}
        </span>
      ) : (
        <span className="italic text-[var(--muted)]">Set goal weight</span>
      )}
    </button>
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
      className="h-4 w-4 text-[var(--muted)]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
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

// --- Goal modal ---------------------------------------------------

/**
 * Modal for setting / editing the bodyweight goal. Clones the
 * BodyweightLogModal shell (centered card, backdrop, escape-to-close,
 * body scroll lock, inline error) so the two read as a set. When a
 * goal is passed it pre-fills for editing; otherwise the unit is
 * seeded from the same localStorage preference the log form uses.
 */
function BodyweightGoalModal({
  busy,
  error,
  goal,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  goal: BodyweightGoal | null;
  onSubmit: (payload: { weight: number; unit: "lb" | "kg" }) => Promise<void>;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(goal ? String(goal.weight) : "");
  const [unit, setUnit] = useState<"lb" | "kg">(() => {
    if (goal) return goal.unit;
    if (typeof window === "undefined") return "lb";
    const stored = window.localStorage.getItem(UNIT_PREFERENCE_KEY);
    return stored === "kg" || stored === "lb" ? stored : "lb";
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // Persist the unit choice only when creating a goal — editing an
  // existing goal seeds from the goal's own unit and shouldn't clobber
  // the log form's saved preference.
  useEffect(() => {
    if (!goal && typeof window !== "undefined") {
      window.localStorage.setItem(UNIT_PREFERENCE_KEY, unit);
    }
  }, [unit, goal]);

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
      setLocalError("Goal weight must be a positive number.");
      return;
    }
    try {
      await onSubmit({ weight: w, unit });
      // Parent closes the modal on success.
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the
      // user can correct + retry without losing their input.
    }
  }

  const shownError = error ?? localError;
  const title = goal ? "Edit goal weight" : "Set goal weight";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bodyweight-goal-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="bodyweight-goal-modal-title" className="text-base font-semibold">
              {title}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Your target weight — it shows as a reference line on the chart.
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
                Goal weight
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="175"
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
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit modal ---------------------------------------------------

/**
 * Modal for editing an existing reading. Clones the BodyweightLogModal
 * shell (centered card, backdrop, escape-to-close, body scroll lock,
 * inline error) and pre-fills weight, unit, and measured_at from the
 * entry. The datetime-local field round-trips through local time:
 * toLocalDatetimeInput on the way in, new Date(...).toISOString() on
 * the way out — same approach as the nutrition LogEntryEditModal.
 */
function BodyweightEditModal({
  entry,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  entry: BodyweightEntry;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: { weight: number; unit: "lb" | "kg"; measured_at: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(String(entry.weight));
  const [unit, setUnit] = useState<"lb" | "kg">(entry.unit);
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() =>
    toLocalDatetimeInput(entry.measured_at),
  );
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
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setLocalError("Weight must be a positive number.");
      return;
    }
    if (!measuredAtLocal) {
      setLocalError("Measured-at is required.");
      return;
    }
    const d = new Date(measuredAtLocal);
    if (Number.isNaN(d.getTime())) {
      setLocalError("Measured-at couldn't be parsed.");
      return;
    }
    try {
      await onSubmit({ weight: w, unit, measured_at: d.toISOString() });
      // Parent closes the modal on success.
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
      aria-labelledby="bodyweight-edit-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="bodyweight-edit-modal-title" className="text-base font-semibold">
              Edit reading
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Fix a mis-keyed weight, unit, or timestamp — the chart updates on save.
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
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Delete modal -------------------------------------------------

/**
 * Confirmation modal for deleting a reading. Replaces the old inline
 * confirm() so the destructive action gets the same shell + busy state
 * treatment as the rest of the page. Echoes the reading being removed
 * so the user can sanity-check before committing.
 */
function BodyweightDeleteModal({
  entry,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  entry: BodyweightEntry;
  busy: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
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

  async function confirm() {
    try {
      await onConfirm();
      // Parent closes the modal on success.
    } catch {
      // Error surfaces via the `error` prop; modal stays open.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bodyweight-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="bodyweight-delete-modal-title" className="text-base font-semibold">
            Delete this reading?
          </h2>
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

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-sm text-[var(--muted)]">
            This removes the reading from your history; the trend chart and stats will update.
          </p>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            <span className="font-medium tabular-nums">
              {formatNumber(entry.weight)} {entry.unit}
            </span>
            <span className="text-[var(--muted)]">
              {" · "}
              {formatRowDate(entry.measured_at)} at {formatRowTime(entry.measured_at)}
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
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
              type="button"
              onClick={confirm}
              disabled={busy}
              className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- helpers ------------------------------------------------------

/** Convert an ISO timestamp to a local "YYYY-MM-DDTHH:mm" string for a
 * <input type="datetime-local">. Uses local getters so the displayed
 * value matches the user's wall clock, mirroring the nutrition modal's
 * toLocalHHMM approach. */
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

// --- useSyncExternalStore plumbing for the mobile media query -----
//
// Tailwind's sm: breakpoint is 640px, so the mobile query matches
// viewports up to 639px inclusive. Hoisted to module scope so React
// gets a stable subscribe function reference across renders, which
// avoids re-subscribing on every render. Mirrors the same plumbing
// in components/date-tile-strip.tsx — when a third consumer arrives
// this can move into a shared hook.

const MOBILE_QUERY = "(max-width: 639px)";

function subscribeMobileQuery(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getMobileServerSnapshot(): boolean {
  // SSR default: desktop layout. The hook re-renders to the actual
  // viewport's value on hydration, so a mobile user sees a single
  // brief flash of the desktop layout before it snaps to the card list.
  return false;
}

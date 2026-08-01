"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  createBloodPressureEntry,
  deleteBloodPressureEntry,
  listBloodPressure,
  updateBloodPressureEntry,
  type BloodPressureEntry,
} from "@/lib/api";
import { CommandBar } from "@/components/command-bar";
import { BpTrendCard } from "./_components/bp-trend-card";
import { BpReadingsTimeline } from "./_components/bp-readings-timeline";
import { BpLogModal, type BpLogModalSubmit } from "./_components/bp-log-modal";
import { BpAbout } from "./_components/bp-about";

/**
 * Blood Pressure — chart-first vitals log, twin of the bodyweight page.
 * This module owns ONLY data fetching, mutations, and layout; the chart,
 * log modal, reading rail, and explainer live in ./_components so this
 * file stays lean (deliberately unlike the bodyweight page's bloat).
 *
 * Page flow, top → bottom in the scroll body:
 *   - Command bar (route into /chat?prompt=… — also the natural-language
 *     log path, e.g. "122 over 78 this morning")
 *   - Range tabs (30 / 60 / 90 / All) whose border-b doubles as the
 *     separator; the range is a client-side viewing window over the
 *     all-time set we fetch once (like bodyweight's whole-range list)
 *   - Hero trend card (chart + stat tiles)
 *   - Pencil-Log toolbar → BpLogModal
 *   - Reading rail (day-grouped, whole-day paginated)
 *   - About card (bottom in the normal state; promoted above the CTA in
 *     the empty state, where it's the only useful content)
 */

/** The browser's wall-clock IANA zone — same helper the dashboard uses. */
function browserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type RangeKey = "30" | "60" | "90" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30", label: "30 days", days: 30 },
  { key: "60", label: "60 days", days: 60 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All", days: null },
];

/** Epoch-ms cutoff for a range's client-side window, or null for "all"
 * (no filter). Readings on/after this instant fall inside the range. */
function sinceForRange(range: RangeKey): number | null {
  const def = RANGES.find((r) => r.key === range);
  if (!def || def.days === null) return null;
  return Date.now() - def.days * 24 * 60 * 60 * 1000;
}

export default function BloodPressurePage() {
  const router = useRouter();
  const isMobile = useSyncExternalStore(
    subscribeMobileQuery,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );

  const [allEntries, setAllEntries] = useState<BloodPressureEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("30");

  const [showLog, setShowLog] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<BloodPressureEntry | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingEntry, setDeletingEntry] = useState<BloodPressureEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCommand = useCallback(
    (value: string) => {
      router.push(`/chat?prompt=${encodeURIComponent(value)}`);
    },
    [router],
  );

  const handleAuthError = useCallback(
    (err: Error): boolean => {
      if (err.message.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router],
  );

  // Fetch the ENTIRE reading history once (no `since`), then let the range
  // tabs window it client-side. The empty state is a property of the whole
  // history, not of the selected range — so it must trigger regardless of
  // which tab is active. Mutations refetch this same all-time list.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listBloodPressure(token, {})
      .then((rows) =>
        setAllEntries(
          [...rows].sort(
            (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
          ),
        ),
      )
      .catch((err: Error) => {
        if (handleAuthError(err)) return;
        setError(err.message);
      });
  }, [router, handleAuthError]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function handleCreate(payload: BpLogModalSubmit): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    setCreateBusy(true);
    setCreateError(null);
    return createBloodPressureEntry(token, payload)
      .then(() => {
        refetch();
      })
      .catch((err: Error) => {
        setCreateError(err.message);
        throw err;
      })
      .finally(() => setCreateBusy(false));
  }

  function handleEditSubmit(payload: BpLogModalSubmit): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    if (!editingEntry) return Promise.reject(new Error("no entry selected"));
    setEditBusy(true);
    setEditError(null);
    return updateBloodPressureEntry(token, editingEntry.id, payload)
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

  function handleDeleteConfirm(): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    if (!deletingEntry) return Promise.reject(new Error("no entry selected"));
    setDeleteBusy(true);
    setDeleteError(null);
    return deleteBloodPressureEntry(token, deletingEntry.id)
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

  // Client-side range window over the all-time set. "all" applies no
  // filter; the others keep readings on/after the range's cutoff.
  const rangeEntries = useMemo(() => {
    const all = allEntries ?? [];
    const since = sinceForRange(range);
    if (since === null) return all;
    return all.filter((e) => new Date(e.measured_at).getTime() >= since);
  }, [allEntries, range]);

  const isEmpty = allEntries !== null && allEntries.length === 0;
  const tz = browserTz();

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Blood Pressure</h1>
        <p className="text-xs text-[var(--muted)]">
          Log readings over time — the chart shows the daily-average systolic/diastolic trend
          against the 130/80 guideline.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <CommandBar
            onSubmit={handleCommand}
            placeholder={'Ask your coach, or log a reading — "122 over 78 this morning"'}
          />

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <RangeTabs
            value={range}
            onChange={setRange}
            count={rangeEntries.length}
            endingLabel={
              rangeEntries.length > 0
                ? new Date(rangeEntries[0].measured_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : null
            }
          />

          {allEntries === null ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : isEmpty ? (
            <EmptyState onLog={() => setShowLog(true)} />
          ) : (
            <>
              <BpTrendCard entries={rangeEntries} timeZone={tz} isMobile={isMobile} />

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <ToolbarButton
                    onClick={() => setShowLog(true)}
                    icon={<PencilIcon />}
                    label="Log"
                  />
                </div>

                {/* When the range window is empty but the user has history
                    elsewhere (isEmpty is false here), BpReadingsTimeline
                    renders its own "widen the range" affordance. */}
                <BpReadingsTimeline
                  entries={rangeEntries}
                  onEdit={(entry) => setEditingEntry(entry)}
                  onDelete={(entry) => setDeletingEntry(entry)}
                />
              </section>

              <BpAbout />
            </>
          )}
        </div>
      </div>

      {showLog && (
        <BpLogModal
          busy={createBusy}
          error={createError}
          onSubmit={handleCreate}
          onClose={() => {
            setShowLog(false);
            setCreateError(null);
          }}
        />
      )}

      {editingEntry && (
        <BpLogModal
          busy={editBusy}
          error={editError}
          initial={{
            systolic: editingEntry.systolic,
            diastolic: editingEntry.diastolic,
            pulse: editingEntry.pulse,
            measured_at: editingEntry.measured_at,
          }}
          onSubmit={handleEditSubmit}
          onClose={() => {
            setEditingEntry(null);
            setEditError(null);
          }}
        />
      )}

      {deletingEntry && (
        <BpDeleteModal
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
    </main>
  );
}

// --- empty state --------------------------------------------------

/**
 * Shown only when the user has no readings at all. The explainer is the
 * one useful thing here, so it's promoted ABOVE a clear first-reading CTA.
 */
function EmptyState({ onLog }: { onLog: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <BpAbout />
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">No readings yet.</p>
        <button
          type="button"
          onClick={onLog}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-80"
        >
          <PencilIcon />
          Log your first reading
        </button>
      </div>
    </div>
  );
}

// --- range tabs ---------------------------------------------------

function RangeTabs({
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

// --- toolbar ------------------------------------------------------

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

// --- delete modal -------------------------------------------------

/**
 * Confirmation modal for deleting a reading. Same shell as BpLogModal
 * (centered card, backdrop, Escape-to-close, body scroll lock, inline
 * error) so the destructive action reads as part of the set. Echoes the
 * reading being removed for a sanity-check before committing.
 */
function BpDeleteModal({
  entry,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  entry: BloodPressureEntry;
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
    } catch {
      // Error surfaces via the `error` prop; modal stays open.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bp-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="bp-delete-modal-title" className="text-base font-semibold">
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
              {entry.systolic}/{entry.diastolic} mmHg
            </span>
            <span className="text-[var(--muted)]">
              {" · "}
              {new Date(entry.measured_at).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {new Date(entry.measured_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
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

// --- mobile media query plumbing ----------------------------------

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
  return false;
}

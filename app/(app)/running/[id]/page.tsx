"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  calibrateRunningSession,
  deleteRunningSession,
  getPlannedWorkoutBySession,
  getRunningSession,
  renameRunningSession,
  setRunningSessionEnvironment,
  unlinkPlannedWorkout,
  type PlannedWorkout,
  type RunningSession,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useToast } from "@/components/toast";
import { formatDuration } from "@/lib/format";
import { deriveRunningActivity, parseTargetPace } from "@/lib/running-splits";
import { formatStartDateTime, runFallbackName } from "../_components/RunListRow";
import { TreadmillBadge } from "../_components/TreadmillBadge";
import { CalibrateDistanceModal } from "./_components/CalibrateDistanceModal";
import { RunHeaderBand } from "./_components/RunHeaderBand";
import { SplitsSpine } from "./_components/SplitsSpine";
import { PaceRecap } from "./_components/PaceRecap";
import { HeartRateZones } from "./_components/HeartRateZones";

/**
 * Run detail. Header carries a back link, an inline-editable run name,
 * and a delete action. Below it, a splits ledger: a compact summary band
 * (with the linked plan's ✓ pill + Unlink and prescription context), the
 * splits spine — a per-distance table with a miles↔intervals toggle gated on
 * detected intervals — and a hero winsorized pace recap. The body derives
 * everything from the session's trackpoints via `deriveRunningActivity`.
 */
export default function RunningDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { unit, unitLabel, formatDistance, formatPace } = useDistanceUnit();

  const [session, setSession] = useState<RunningSession | null>(null);
  const [completesPlan, setCompletesPlan] = useState<PlannedWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [environmentBusy, setEnvironmentBusy] = useState(false);

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

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // Best-effort: surface the plan this run fulfilled (non-critical).
    getPlannedWorkoutBySession(token, id, "activity")
      .then(setCompletesPlan)
      .catch(() => {});
    getRunningSession(token, id)
      .then((s) => {
        setError(null);
        setNotFound(false);
        setSession(s);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        const msg = err instanceof Error ? err.message : "Failed to load run";
        if (msg.toLowerCase().includes("not found")) {
          setNotFound(true);
          return;
        }
        setError(msg);
      });
  }, [id, router, handleAuthError]);

  // Derive the splits ledger (splits, pace recap, detected intervals) from the
  // session's trackpoints, the linked plan's run type, and the active unit.
  const derivation = useMemo(
    () => deriveRunningActivity(session?.trackpoints ?? [], completesPlan?.run_type ?? null, unit),
    [session, completesPlan, unit],
  );
  const targetPace = useMemo(
    () => parseTargetPace(completesPlan?.run_details ?? null, unit),
    [completesPlan, unit],
  );

  async function handleRename(name: string) {
    if (!session) return;
    const trimmed = name.trim();
    const current = session.name ?? "";
    if (trimmed === current) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const prev = session;
    // Optimistic — splice the new name in, roll back on failure.
    setSession({ ...session, name: trimmed });
    try {
      const updated = await renameRunningSession(token, id, trimmed);
      setSession((s) => (s ? { ...s, ...updated, trackpoints: s.trackpoints } : updated));
    } catch (err) {
      setSession(prev);
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function handleDelete() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      await deleteRunningSession(token, id);
      toast.success("Run deleted.");
      router.push("/activities?view=running");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setConfirmingDelete(false);
    }
  }

  async function handleUnlink() {
    if (!completesPlan) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setUnlinking(true);
    try {
      await unlinkPlannedWorkout(token, completesPlan.id);
      setCompletesPlan(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Unlink failed");
    } finally {
      setUnlinking(false);
    }
  }

  // Reset = calibrate back to the originally-ingested distance. Like any
  // calibration, the API returns the full rescaled session, so we replace
  // state wholesale to keep header + splits consistent.
  async function handleReset() {
    if (!session) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const updated = await calibrateRunningSession(token, id, session.raw_distance_meters);
      setSession(updated);
      toast.success("Reset to the original distance.");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  // Toggle outdoor ↔ indoor. Switching to outdoor can add the run back into
  // PR surfaces; to indoor removes it — so confirm the PR-membership change.
  // The PATCH returns a summary (no trackpoints); an environment change never
  // rescales trackpoints, so keep the existing ones.
  async function handleSetEnvironment(next: "outdoor" | "indoor") {
    if (!session || session.environment === next) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const message =
      next === "indoor"
        ? "Tag this run as a treadmill run? It will be removed from your running PRs and best-efforts."
        : "Tag this run as outdoor? It will be added back into your running PRs and best-efforts.";
    if (!window.confirm(message)) return;
    setEnvironmentBusy(true);
    try {
      const updated = await setRunningSessionEnvironment(token, id, next);
      // Keep the current trackpoints — the summary response omits them and
      // an environment change doesn't rescale them.
      setSession((s) => (s ? { ...s, ...updated, trackpoints: s.trackpoints } : updated));
      toast.success(next === "indoor" ? "Tagged as treadmill run." : "Tagged as outdoor run.");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to change environment");
    } finally {
      setEnvironmentBusy(false);
    }
  }

  if (notFound) {
    return (
      <CenteredMessage>
        <p className="text-sm font-medium">Run not found</p>
        <Link
          href="/activities?view=running"
          className="mt-2 text-xs text-[var(--accent)] hover:underline"
        >
          ← Back to runs
        </Link>
      </CenteredMessage>
    );
  }

  if (error) {
    return (
      <CenteredMessage>
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
        <Link
          href="/activities?view=running"
          className="mt-3 text-xs text-[var(--accent)] hover:underline"
        >
          ← Back to runs
        </Link>
      </CenteredMessage>
    );
  }

  if (!session) {
    return (
      <CenteredMessage>
        <p className="text-sm text-[var(--muted)]">Loading run…</p>
      </CenteredMessage>
    );
  }

  const isRun = session.activity_type === "running";
  const isIndoorRun = isRun && session.environment === "indoor";

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <Link
          href="/activities?view=running"
          className="w-fit text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← Runs
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <EditableName
                name={session.name}
                fallback={runFallbackName(session.start_time)}
                onSave={handleRename}
              />
              {isIndoorRun && <TreadmillBadge />}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {formatStartDateTime(session.start_time)} · {formatDuration(session.duration_seconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="shrink-0 rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <RunHeaderBand
            cells={[
              {
                label: "Distance",
                value: `${formatDistance(session.distance_meters)} ${unitLabel}`,
              },
              { label: "Time", value: formatDuration(session.duration_seconds) },
              {
                label: "Avg pace",
                value: `${formatPace(session.avg_pace_sec_per_km)} /${unitLabel}`,
              },
              {
                label: "Best",
                value:
                  session.best_pace_sec_per_km != null
                    ? `${formatPace(session.best_pace_sec_per_km)} /${unitLabel}`
                    : "—",
              },
              {
                label: "Avg HR",
                value: session.avg_heart_rate_bpm != null ? `${session.avg_heart_rate_bpm}` : "—",
              },
              {
                label: "Max HR",
                value: session.max_heart_rate_bpm != null ? `${session.max_heart_rate_bpm}` : "—",
              },
              {
                label: "Calories",
                value: session.total_calories != null ? String(session.total_calories) : "—",
              },
              {
                label: "Elev",
                value:
                  session.elevation_gain_meters != null
                    ? `${session.elevation_gain_meters.toFixed(0)} m`
                    : "—",
              },
            ]}
            planName={completesPlan?.name ?? (completesPlan ? "Planned run" : null)}
            prescription={completesPlan?.run_details ?? null}
            onUnlink={completesPlan ? handleUnlink : undefined}
            unlinking={unlinking}
          />
          {isRun && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <EnvironmentToggle
                value={session.environment}
                disabled={environmentBusy}
                onChange={handleSetEnvironment}
              />
              {isIndoorRun && (
                <button
                  type="button"
                  onClick={() => setCalibrateOpen(true)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition hover:opacity-80"
                >
                  Calibrate distance
                </button>
              )}
              {session.raw_distance_meters !== session.distance_meters && (
                <p className="text-xs text-[var(--muted)]">
                  Calibrated from {formatDistance(session.raw_distance_meters)} {unitLabel} ·{" "}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[var(--accent)] transition hover:underline"
                  >
                    Reset
                  </button>
                </p>
              )}
            </div>
          )}
          <SplitsSpine
            splits={derivation.splits}
            intervals={derivation.intervals}
            unitLabel={unitLabel}
            formatDistance={formatDistance}
            hasTargetColumn={targetPace != null}
            targetPaceSecPerUnit={targetPace}
          />
          <PaceRecap points={derivation.paceStrip} hasDropout={derivation.hasDropout} unit={unit} />
          <HeartRateZones zones={session.heart_rate_zones} />
        </div>
      </div>

      {confirmingDelete && (
        <DeleteConfirmModal onCancel={() => setConfirmingDelete(false)} onConfirm={handleDelete} />
      )}

      {calibrateOpen && (
        <CalibrateDistanceModal
          session={session}
          onClose={() => setCalibrateOpen(false)}
          onCalibrated={(updated) => {
            // Replace the WHOLE session (including trackpoints) so the header
            // and the trackpoint-derived splits stay consistent.
            setSession(updated);
            setCalibrateOpen(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * Full-pill segmented Outdoor/Indoor control (design-system segmented toggle:
 * a `--surface` track, the active segment an `--accent` fill with
 * `--accent-fg`, inactive segments `--muted` brightening to `--foreground`).
 */
function EnvironmentToggle({
  value,
  disabled,
  onChange,
}: {
  value: "outdoor" | "indoor";
  disabled?: boolean;
  onChange: (next: "outdoor" | "indoor") => void;
}) {
  const options: { key: "outdoor" | "indoor"; label: string }[] = [
    { key: "outdoor", label: "Outdoor" },
    { key: "indoor", label: "Indoor" },
  ];
  return (
    <div
      role="group"
      aria-label="Run environment"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            disabled={disabled || active}
            onClick={() => onChange(opt.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-default ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      {children}
    </main>
  );
}

/**
 * Click-to-edit run name. Shows the name (or a date-derived fallback)
 * as a heading; clicking swaps in a text input. Enter / blur commit via
 * `onSave`; Escape reverts. The committed value is optimistic upstream.
 */
function EditableName({
  name,
  fallback,
  onSave,
}: {
  name: string | null;
  fallback: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setDraft(name ?? "");
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    if (!editing) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed.length > 0) onSave(trimmed);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-lg font-semibold tracking-tight outline-none focus:border-[var(--accent)]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Click to rename"
      className="group flex w-fit items-center gap-2 text-left text-lg font-semibold tracking-tight"
    >
      <span className="truncate">{name?.trim() || fallback}</span>
      <PencilIcon />
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--muted)] opacity-0 transition group-hover:opacity-100"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function DeleteConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="run-delete-modal-title" className="text-base font-semibold">
            Delete run?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-sm">Delete this run? This can&apos;t be undone.</p>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                onConfirm();
              }}
              disabled={busy}
              className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

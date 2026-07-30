"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteRunningSession,
  getRunningSession,
  renameRunningSession,
  updateRunningSessionNotes,
  type RunningSession,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useToast } from "@/components/toast";
import { formatDuration } from "@/lib/format";
import { buildElevationStrip, buildHeartRateStrip, hasPlottableSeries } from "@/lib/running-traces";
import { mileMarkers, readoutAt, remainingClimb } from "@/lib/elevation-scrub";
import { ElevationScrubCaption } from "@/components/activity-detail/ElevationScrubCaption";
import { formatStartDateTime } from "../../running/_components/RunListRow";
import { hikeFallbackName } from "../_components/HikeListRow";
import { NotesEditor } from "@/components/activity-detail/NotesEditor";
import { MapView } from "@/components/activity-detail/MapView";
import { SectionKicker } from "@/components/activity-detail/SectionKicker";
import { HeartRateRecap } from "@/components/activity-detail/HeartRateRecap";
import { ElevationRecap } from "@/components/activity-detail/ElevationRecap";

/**
 * Hike detail. The same session-recap grammar as the run detail page, but
 * retoned for hiking and pared to what a hike is about: a header stat strip
 * that LEADS with distance / vertical gain / duration, and the elevation
 * profile as the page's CENTERPIECE chart (not a supporting sibling). No
 * splits ledger, pace recap, calibrate/environment chrome, or plan context —
 * a hike isn't paced or PR-tracked. The body is render-only: the only client
 * mapping is trackpoints → chart coordinates (`buildElevationStrip` /
 * `buildHeartRateStrip`). Toggling the unit refetches the detail.
 */
export default function HikingDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { unit, unitLabel, formatDistance, formatElevation } = useDistanceUnit();

  const [session, setSession] = useState<RunningSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    getRunningSession(token, id, unit)
      .then((s) => {
        setError(null);
        setNotFound(false);
        setSession(s);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        const msg = err instanceof Error ? err.message : "Failed to load hike";
        if (msg.toLowerCase().includes("not found")) {
          setNotFound(true);
          return;
        }
        setError(msg);
      });
  }, [id, unit, router, handleAuthError]);

  // The only client mapping is trackpoints → chart coordinates.
  const hrStrip = useMemo(
    () => buildHeartRateStrip(session?.trackpoints ?? [], unit),
    [session, unit],
  );
  const elevStrip = useMemo(
    () => buildElevationStrip(session?.trackpoints ?? [], unit),
    [session, unit],
  );

  // --- linked elevation profile + map ------------------------------------
  // ONE index is the whole binding. `buildElevationStrip` is a straight map
  // over the trackpoints, so strip index i is trackpoint i is route position i
  // — the chart cursor, the map marker, the travelled overlay, and the caption
  // readout all derive from this single number.
  const trackpoints = useMemo(() => session?.trackpoints ?? [], [session]);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Suffix sums, computed once per track rather than per pointer frame.
  const climb = useMemo(() => remainingClimb(trackpoints), [trackpoints]);
  const readout = useMemo(
    () => readoutAt(trackpoints, climb, scrubIndex),
    [trackpoints, climb, scrubIndex],
  );
  const markers = useMemo(() => mileMarkers(trackpoints, unit), [trackpoints, unit]);

  // A cursor from one hike must not survive into the next, or into a unit
  // toggle that refetches a different-length track. Adjusted during render
  // rather than in an effect — React re-renders immediately without committing
  // the stale cursor, so there is no frame where the marker sits on the wrong
  // sample and no cascading-render warning.
  const [cursorTrack, setCursorTrack] = useState(trackpoints);
  if (cursorTrack !== trackpoints) {
    setCursorTrack(trackpoints);
    setScrubIndex(null);
  }

  // Idempotent on an unchanged value: the map and the chart both call this, and
  // without the guard a hover that lands on the same sample re-renders the page
  // on every pointer frame.
  const handleScrub = useCallback((index: number | null) => {
    setScrubIndex((prev) => (prev === index ? prev : index));
  }, []);

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

  async function handleSaveNotes(next: string) {
    if (!session) return;
    const current = session.notes ?? "";
    if (next === current) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const prev = session;
    // Optimistic — splice the new note in, roll back on failure.
    setSession({ ...session, notes: next });
    try {
      const updated = await updateRunningSessionNotes(token, id, next);
      setSession((s) => (s ? { ...s, ...updated, trackpoints: s.trackpoints } : updated));
    } catch (err) {
      setSession(prev);
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to save note");
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
      toast.success("Hike deleted.");
      router.push("/activities?view=hiking");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setConfirmingDelete(false);
    }
  }

  if (notFound) {
    return (
      <CenteredMessage>
        <p className="text-sm font-medium">Hike not found</p>
        <Link
          href="/activities?view=hiking"
          className="mt-2 text-xs text-[var(--accent)] hover:underline"
        >
          ← Back to hikes
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
          href="/activities?view=hiking"
          className="mt-3 text-xs text-[var(--accent)] hover:underline"
        >
          ← Back to hikes
        </Link>
      </CenteredMessage>
    );
  }

  if (!session) {
    return (
      <CenteredMessage>
        <p className="text-sm text-[var(--muted)]">Loading hike…</p>
      </CenteredMessage>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Slim utility chrome: back link + delete. The title/date/notes move
          into the editorial body below. */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3">
        <Link
          href="/activities?view=hiking"
          className="w-fit text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← Hikes
        </Link>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="shrink-0 rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
        >
          Delete
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-10">
          {/* 1 — Editorial lead: date kicker → 4xl title → notes as prose. */}
          <div className="flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--faint)]">
              {formatStartDateTime(session.start_time)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <EditableName
                name={session.name}
                fallback={hikeFallbackName(session.start_time)}
                onSave={handleRename}
                textClass="text-4xl"
              />
            </div>
            <NotesEditor
              notes={session.notes}
              onSave={handleSaveNotes}
              prompt="How did this hike feel?"
            />
          </div>

          {/* 2 — Quiet inline strip: distance / vertical gain / duration lead,
              then optional high/low point + HR + calories. */}
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y border-[var(--border)] py-4">
            <StripEntry
              label="Distance"
              value={`${formatDistance(session.distance_meters)} ${unitLabel}`}
            />
            <StripEntry
              label="Vertical gain"
              value={formatElevation(session.elevation_gain_meters)}
            />
            <StripEntry label="Duration" value={formatDuration(session.duration_seconds)} />
            {session.elevation_high_meters != null && (
              <StripEntry
                label="High point"
                value={formatElevation(session.elevation_high_meters)}
              />
            )}
            {session.elevation_low_meters != null && (
              <StripEntry label="Low point" value={formatElevation(session.elevation_low_meters)} />
            )}
            {session.avg_heart_rate_bpm != null && (
              <StripEntry label="Avg HR" value={`${session.avg_heart_rate_bpm}`} />
            )}
            {session.total_calories != null && (
              <StripEntry label="Calories" value={String(session.total_calories)} />
            )}
          </dl>

          {/* 3 — Route map. Linked to the elevation profile below through
              `scrubIndex`: hovering the route moves the profile cursor, and
              the profile moves the marker here. Self-hides with no route. */}
          <MapView
            route={session.route}
            discipline="hike"
            label="Hike route map"
            trackpoints={trackpoints}
            scrubIndex={scrubIndex}
            onScrub={handleScrub}
            mileMarkers={markers}
          />

          {/* 4 — Elevation profile — the CENTERPIECE chart of a hike, and the
              other half of the linked instrument. */}
          {hasPlottableSeries(elevStrip) && (
            <section className="flex flex-col gap-3">
              <SectionKicker discipline="hike">Elevation profile</SectionKicker>
              <ElevationRecap
                points={elevStrip}
                gainMeters={session.elevation_gain_meters}
                unit={unit}
                discipline="hike"
                scrubIndex={scrubIndex}
                onScrub={handleScrub}
                caption={
                  <ElevationScrubCaption
                    readout={readout}
                    scrubbing={scrubIndex != null}
                    totals={{
                      ascentMeters: session.elevation_gain_meters,
                      descentMeters: session.elevation_loss_meters,
                      highMeters: session.elevation_high_meters,
                      lowMeters: session.elevation_low_meters,
                      distanceMeters: session.distance_meters,
                    }}
                    formatElevation={formatElevation}
                    formatDistance={formatDistance}
                    unitLabel={unitLabel}
                  />
                }
              />
            </section>
          )}

          {/* 5 — Heart-rate recap (gated on a plottable series). */}
          {hasPlottableSeries(hrStrip) && (
            <HeartRateRecap
              points={hrStrip}
              avgBpm={session.avg_heart_rate_bpm}
              maxBpm={session.max_heart_rate_bpm}
              unit={unit}
            />
          )}
        </div>
      </div>

      {confirmingDelete && (
        <DeleteConfirmModal onCancel={() => setConfirmingDelete(false)} onConfirm={handleDelete} />
      )}
    </main>
  );
}

/**
 * One entry of the quiet inline strip: a value over a small uppercase label.
 * Numbers SUPPORT — they don't lead — so the value sits at reading size, the
 * label as faint metadata beneath it.
 */
function StripEntry({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dd className="text-base font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
        {value}
      </dd>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{label}</dt>
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
 * Click-to-edit hike name. Shows the name (or a date-derived fallback)
 * as a heading; clicking swaps in a text input. Enter / blur commit via
 * `onSave`; Escape reverts. The committed value is optimistic upstream.
 */
function EditableName({
  name,
  fallback,
  onSave,
  textClass = "text-lg",
}: {
  name: string | null;
  fallback: string;
  onSave: (name: string) => void;
  textClass?: string;
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
        className={`w-full max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-semibold tracking-tight outline-none focus:border-[var(--accent)] ${textClass}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Click to rename"
      className={`group flex w-fit items-center gap-2 text-left font-semibold tracking-tight ${textClass}`}
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
      aria-labelledby="hike-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="hike-delete-modal-title" className="text-base font-semibold">
            Delete hike?
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
          <p className="text-sm">Delete this hike? This can&apos;t be undone.</p>
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

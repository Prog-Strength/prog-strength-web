"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  calibrateRunningSession,
  deleteRunningSession,
  getActivity,
  getPlannedWorkoutBySession,
  renameRunningSession,
  setRunningSessionEnvironment,
  unlinkPlannedWorkout,
  updateRunningSessionNotes,
  type Activity,
  type PlannedWorkout,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/components/toast";
import { formatDuration } from "@/lib/format";
import { buildPaceStrip, parseTargetPace } from "@/lib/running-splits";
import { buildHeartRateStrip, buildElevationStrip, hasPlottableSeries } from "@/lib/running-traces";
import { formatStartDateTime, runFallbackName } from "../_components/RunListRow";
import { TreadmillBadge } from "../_components/TreadmillBadge";
import { NotesEditor } from "@/components/activity-detail/NotesEditor";
import { MapView } from "@/components/activity-detail/MapView";
import { SectionKicker } from "@/components/activity-detail/SectionKicker";
import { HeartRateRecap } from "@/components/activity-detail/HeartRateRecap";
import { ElevationRecap } from "@/components/activity-detail/ElevationRecap";
import { WeatherRecap } from "@/components/activity-detail/WeatherRecap";
import { CalibrateDistanceModal } from "./_components/CalibrateDistanceModal";
import { SplitsSpine } from "./_components/SplitsSpine";
import { PaceRecap } from "./_components/PaceRecap";
import { HeartRateZones } from "@/components/activity-detail/HeartRateZones";
import { PhotoStrip } from "@/components/activity-detail/PhotoStrip";
import { VideoStrip } from "@/components/activity-detail/VideoStrip";

/**
 * Run detail. Header carries a back link, an inline-editable run name,
 * and a delete action. Below it, a splits ledger: a compact summary band
 * (with the linked plan's ✓ pill + Unlink and prescription context), the
 * splits spine — a per-distance table with a miles↔intervals toggle gated on
 * detected intervals — and a hero pace recap. The body is RENDER-ONLY: the
 * splits/strip-summary/intervals/best-pace all arrive server-derived on the
 * unit-aware detail response; the only client mapping is trackpoints → chart
 * coordinates (`buildPaceStrip`). Toggling the unit refetches the detail.
 */
export default function RunningDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { unit, unitLabel, formatDistance, formatPace, formatElevation } = useDistanceUnit();
  const { profile } = useProfile();

  // Typed as the unified `Activity` (a superset of RunningSession) rather than
  // RunningSession: `photos` and `user_id` ride on the unified read shape only,
  // and the photo strip needs both. Same endpoint, same params — `getActivity`
  // is `getRunningSession` with the fuller type.
  const [session, setSession] = useState<Activity | null>(null);
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
    getActivity(token, id, unit)
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
  }, [id, unit, router, handleAuthError]);

  // Re-fetch the detail so the photo strip reflects an add / delete / reorder.
  // The photos ride along on the same response, so one fetch refreshes the
  // strip without an extra hop — mirroring the workout detail page.
  const reloadPhotos = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setSession(await getActivity(token, id, unit));
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof Error ? err.message : "Failed to refresh photos");
    }
  }, [id, unit, handleAuthError, toast]);

  // This detail route only ever serves the viewer's own activities
  // (GET /activities/{id} is scoped to the authed user — another user's id
  // 404s), so the viewer is the owner. When the DTO carries `user_id` we still
  // confirm it matches the profile; when it's absent we fall back to true
  // rather than hiding the owner controls on the user's own session.
  const isOwner = session ? (session.user_id ? profile?.id === session.user_id : true) : false;

  // The splits/intervals/summary all arrive server-derived; the only client
  // mapping is trackpoints → chart coordinates.
  const paceStrip = useMemo(
    () => buildPaceStrip(session?.trackpoints ?? [], unit),
    [session, unit],
  );
  const hrStrip = useMemo(
    () => buildHeartRateStrip(session?.trackpoints ?? [], unit),
    [session, unit],
  );
  const elevStrip = useMemo(
    () => buildElevationStrip(session?.trackpoints ?? [], unit),
    [session, unit],
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
      const updated = await calibrateRunningSession(token, id, session.raw_distance_meters, unit);
      // Calibrate replaces the WHOLE session, but its typed wrapper returns the
      // narrower RunningSession — carry the photos over so the strip doesn't
      // blank out until the next load.
      setSession((s) => ({ ...updated, photos: s?.photos, user_id: s?.user_id }));
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

  const planName = completesPlan?.name ?? (completesPlan ? "Planned run" : null);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Slim utility chrome: back link + delete. The title/date/notes move
          into the editorial body below. */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3">
        <Link
          href="/activities?view=running"
          className="w-fit text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← Runs
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
                fallback={runFallbackName(session.start_time)}
                onSave={handleRename}
                textClass="text-4xl"
              />
              {isIndoorRun && <TreadmillBadge />}
            </div>
            <NotesEditor notes={session.notes} onSave={handleSaveNotes} />
          </div>

          {/* 2 — Media. Sits between the overview (lead + note) and the work
              (numbers, splits, charts), the same slot the workout detail gives
              it. Self-hides for a non-owner with no photos. */}
          {(isOwner || (session.photos && session.photos.length > 0)) && (
            <PhotoStrip
              photos={session.photos ?? []}
              activityId={session.id}
              activityName={session.name?.trim() || runFallbackName(session.start_time)}
              isOwner={isOwner}
              onPhotosChanged={reloadPhotos}
            />
          )}

          {/* Videos share the media slot. Every activity detail route renders
              this — see sows/activity-videos.md § Route coverage. */}
          {(isOwner || (session.videos && session.videos.length > 0)) && (
            <VideoStrip
              videos={session.videos ?? []}
              activityId={session.id}
              activityName={session.name?.trim() || runFallbackName(session.start_time)}
              isOwner={isOwner}
              onVideosChanged={reloadPhotos}
            />
          )}

          {/* 3 — Quiet inline strip: numbers support, they don't lead. */}
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y border-[var(--border)] py-4">
            <StripEntry
              label="Distance"
              value={`${formatDistance(session.distance_meters)} ${unitLabel}`}
            />
            <StripEntry label="Time" value={formatDuration(session.duration_seconds)} />
            <StripEntry
              label="Avg pace"
              value={`${formatPace(session.avg_pace_sec_per_km)} /${unitLabel}`}
            />
            {session.elevation_gain_meters != null && (
              <StripEntry
                label="Elev gain"
                value={formatElevation(session.elevation_gain_meters)}
              />
            )}
            {session.avg_heart_rate_bpm != null && (
              <StripEntry label="Avg HR" value={`${session.avg_heart_rate_bpm}`} />
            )}
            {session.total_calories != null && (
              <StripEntry label="Calories" value={String(session.total_calories)} />
            )}
          </dl>

          {/* 4 — Plan context: ✓ pill + unlink + prescription, directly under
              the strip (SOW Resolved Q1). */}
          {completesPlan && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--discipline-run-bg)",
                    color: "var(--discipline-run-fg)",
                  }}
                >
                  ✓ {planName}
                </span>
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="text-xs text-[var(--muted)] transition hover:text-[var(--danger)] disabled:opacity-50"
                >
                  {unlinking ? "Unlinking…" : "Unlink"}
                </button>
              </div>
              {completesPlan.run_details && (
                <p className="text-xs text-[var(--muted)]">{completesPlan.run_details}</p>
              )}
            </div>
          )}

          {/* 5 — Operational chrome: quiet editorial line (run only). */}
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

          {/* 6 — Route map (self-hides when route is undefined). */}
          <MapView route={session.route} discipline="run" label="Run route map" />

          {/* 7 — Conditions. Shares the map's beat: both answer "where, and
              what was it like" before the work begins. Rides the detail
              response — no second round trip — and self-hides for an indoor
              run or a run with no stored reading. */}
          <WeatherRecap
            weather={session.weather}
            environment={session.environment}
            discipline="run"
          />

          {/* 8 — The Miles. */}
          <section className="flex flex-col gap-3">
            <SectionKicker>The Miles</SectionKicker>
            <SplitsSpine
              splits={session.splits ?? []}
              intervals={
                // The run-type gate stays client-side: the server always
                // computes candidate intervals; show them only when the linked
                // plan says intervals.
                completesPlan?.run_type === "intervals" ? (session.intervals ?? null) : null
              }
              unitLabel={unitLabel}
              formatDistance={formatDistance}
              hasTargetColumn={targetPace != null}
              targetPaceSecPerUnit={targetPace}
            />
          </section>

          {/* 9 — Sibling recaps. */}
          <PaceRecap points={paceStrip} stripSummary={session.strip_summary ?? null} unit={unit} />
          {hasPlottableSeries(hrStrip) && (
            <HeartRateRecap
              points={hrStrip}
              avgBpm={session.avg_heart_rate_bpm}
              maxBpm={session.max_heart_rate_bpm}
              unit={unit}
            />
          )}
          {hasPlottableSeries(elevStrip) && (
            <ElevationRecap
              points={elevStrip}
              gainMeters={session.elevation_gain_meters}
              unit={unit}
            />
          )}

          {/* 10 — Time in heart-rate zones (gate the whole section). */}
          {session.heart_rate_zones && session.heart_rate_zones.zones.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionKicker>Time in heart-rate zones</SectionKicker>
              <HeartRateZones zones={session.heart_rate_zones} />
            </section>
          )}
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
            // and the trackpoint-derived splits stay consistent — but carry the
            // photos over, which the narrower calibrate shape doesn't restate.
            setSession((s) => ({ ...updated, photos: s?.photos, user_id: s?.user_id }));
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
 * Click-to-edit run name. Shows the name (or a date-derived fallback)
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

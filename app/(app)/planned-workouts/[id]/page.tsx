"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deletePlannedWorkout,
  getActivity,
  getCalendarConnection,
  getPlannedWorkout,
  listExercises,
  resyncPlannedWorkout,
  unlinkPlannedWorkout,
  type CompletedSessionKind,
  type Exercise,
  type PlannedWorkout,
} from "@/lib/api";
import { PlannedBanner } from "@/components/calendar/planned-banner";
import { PlannedAgendaDetails } from "@/components/calendar/planned-agenda-details";
import { PlannedWorkoutModal } from "@/components/planned-workout-modal";

/**
 * Single planned-workout detail route — the landing page for the "Open in
 * Prog Strength" deep link the API drops into a synced Google Calendar
 * event's description (internal/calendarsync/render.go), and reachable from
 * anywhere a plan is referenced by id.
 *
 * Reuses the calendar's PlannedBanner for the read-only render (status,
 * Google sync indicator + Resync, the expandable agenda, and the link to a
 * completed plan's logged session) so this page and the calendar digest stay
 * in lockstep. The header carries the plan-level Edit (opens the shared
 * PlannedWorkoutModal) and Delete affordances, mirroring the workout detail
 * page.
 */

export default function PlannedWorkoutDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  // The completed plan's logged-session kind, derived from the session's
  // own activity_type (the API no longer sends completed_session_kind).
  // null until (unless) the best-effort lookup resolves; gates the
  // banner's "View logged run/workout →" link.
  const [completedKind, setCompletedKind] = useState<CompletedSessionKind | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([getPlannedWorkout(token, id), listExercises()])
      .then(([p, es]) => {
        setPlan(p);
        setExercises(es);
        // Best-effort: resolve the completed session to learn its kind
        // (strength row → workout, anything else → activity). A failed
        // lookup just leaves the "View logged" link hidden.
        if (p.status === "completed" && p.completed_session_id) {
          getActivity(token, p.completed_session_id)
            .then((a) =>
              setCompletedKind(a.activity_type === "strength_training" ? "workout" : "activity"),
            )
            .catch(() => setCompletedKind(null));
        } else {
          setCompletedKind(null);
        }
      })
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
    // Connection state only gates the modal's "Sync to Google Calendar"
    // checkbox — best-effort, a failure just hides it.
    getCalendarConnection(token)
      .then((conn) => setCalendarConnected(conn.status === "connected"))
      .catch(() => setCalendarConnected(false));
  }, [id, router]);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const handleResync = async () => {
    if (!plan) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      setPlan(await resyncPlannedWorkout(token, plan.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resync failed");
    }
  };

  const handleUnlink = async () => {
    if (!plan) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      setPlan(await unlinkPlannedWorkout(token, plan.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlink failed");
    }
  };

  const handleNavigateSession = (kind: CompletedSessionKind, sessionId: string) => {
    router.push(kind === "activity" ? `/running/${sessionId}` : `/workouts/${sessionId}`);
  };

  const handleDelete = async () => {
    if (!plan) return;
    const label = plan.name?.trim() || formatDateTime(plan.scheduled_start);
    if (
      !window.confirm(`Delete "${label}"? This removes the planned workout from your calendar.`)
    ) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setDeleting(true);
    try {
      await deletePlannedWorkout(token, plan.id);
      router.replace("/calendar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const title = plan ? plan.name?.trim() || planFallbackTitle(plan) : "Planned workout";

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <Link
          href="/calendar"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Calendar
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {plan && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatDateTime(plan.scheduled_start)}
                {" – "}
                {formatTime(plan.scheduled_end)}
              </p>
            )}
          </div>
          {plan && (
            <div className="flex shrink-0 gap-2">
              {plan.status === "planned" && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-sm text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && plan === null && (
            <p className="text-sm text-[var(--muted)]">Loading planned workout…</p>
          )}

          {plan && (
            <div className="flex flex-col gap-4">
              <PlannedBanner
                planned={plan}
                completedSessionKind={completedKind}
                onResync={handleResync}
                onNavigateSession={handleNavigateSession}
                onUnlink={handleUnlink}
              />
              {plan.activity_kind === "lift" && plan.exercises.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <PlannedAgendaDetails exercises={plan.exercises} exerciseMap={exerciseMap} />
                </div>
              )}
              {plan.activity_kind === "run" && plan.run_details?.trim() && (
                <p className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                  {plan.run_details}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {plan && editing && (
        <PlannedWorkoutModal
          plan={plan}
          catalog={exercises}
          calendarConnected={calendarConnected}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setPlan(saved);
            setEditing(false);
          }}
        />
      )}
    </main>
  );
}

// --- helpers --------------------------------------------------------------

/** Title for an unnamed plan, mirroring PlannedBanner: "Lift · 6:00 PM". */
function planFallbackTitle(plan: PlannedWorkout): string {
  const kind = plan.activity_kind === "run" ? "Run" : "Lift";
  return `${kind} · ${formatTime(plan.scheduled_start)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

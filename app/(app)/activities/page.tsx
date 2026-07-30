"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getMe, type ResolvedProfile } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";
import { ActivitiesOverviewView } from "@/components/activities/activities-overview-view";
import { WorkoutsView } from "@/components/activities/workouts-view";
import { RunningView } from "@/components/activities/running-view";
import { HikingView } from "@/components/activities/hiking-view";
import { StepsView } from "@/components/activities/steps-view";
import { ToolbarButton } from "@/components/toolbar-button";
import { WorkoutTCXUploadModal } from "@/components/workout-tcx-upload-modal";

type View = "overview" | "workouts" | "running" | "hiking" | "steps";
type Timeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAMES: { id: Timeframe; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: null },
];

/**
 * Activities — one URL-backed shell over three sub-views (Overview /
 * Workouts / Running), sharing a single page-level timeframe. The
 * `?view=` param is the source of truth for the active view; the
 * timeframe pills live in the header and scope all three views.
 *
 * Split into an outer Suspense wrapper and an inner component so the
 * inner can call `useSearchParams` without tripping Next 16's prerender
 * requirement (see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
 * Mirrors the validated nutrition/page.tsx pattern.
 */
export default function ActivitiesPage() {
  return (
    <Suspense fallback={null}>
      <ActivitiesPageInner />
    </Suspense>
  );
}

function ActivitiesPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const rawView = search.get("view");
  const view: View =
    rawView === "workouts" || rawView === "running" || rawView === "hiking" || rawView === "steps"
      ? rawView
      : "overview";

  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const days = useMemo(() => TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? null, [timeframe]);

  // One-time user fetch drives the display unit (lb/kg) shared across
  // views. Token guard owns the redirect; non-401 getMe errors are
  // swallowed because each view owns its own error surface and the
  // shell stays minimal.
  const [user, setUser] = useState<ResolvedProfile | null>(null);
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe(token)
      .then(setUser)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
        }
        // non-401: swallow — the views render their own errors.
      });
  }, [router]);

  const displayUnit = user?.weight_unit ?? "lb";
  const { unitLabel: distanceUnit } = useDistanceUnit();

  // Owned here because the Upload TCX *button* lives in the toolbar; the
  // modal itself lives in RunningView, which closes via the callback.
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // The Workouts-view "Log from TCX" action: mint an empty workout from a
  // Garmin strength TCX, then land on its detail page to add exercises.
  const [logFromTcxOpen, setLogFromTcxOpen] = useState(false);

  // The Workouts view-specific action also lives in the toolbar (left
  // group) for parity with Upload TCX, so both sub-views surface their
  // primary action in the same place and style. Start a fresh live
  // session (or resume an existing one) and land on the live screen;
  // when a session already exists we don't re-start it — just navigate,
  // so an in-progress workout is never clobbered.
  const { session, start } = useActiveWorkoutSession();
  const startOrResumeWorkout = () => {
    if (!session) start();
    router.push("/workout/live");
  };

  const setView = (next: View) => {
    if (next === "overview") router.replace("/activities");
    else router.replace(`/activities?view=${next}`);
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Activities</h1>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => {
            const active = tf.id === timeframe;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--faint)] hover:text-[var(--foreground)]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* Toolbar row: left group holds the view-specific action
              (Upload TCX, Running only); right group switches views.
              The bottom border doubles as the separator under the
              toolbar. Labels collapse to icon-only below sm: via
              ToolbarButton so all controls fit a 375px viewport. */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-3 sm:gap-5">
              {view === "workouts" && (
                <>
                  <ToolbarButton
                    onClick={startOrResumeWorkout}
                    icon={<PlayIcon />}
                    label={session ? "Resume workout" : "Start live workout"}
                  />
                  <ToolbarButton
                    onClick={() => setLogFromTcxOpen(true)}
                    icon={<UploadIcon />}
                    label="Log from TCX"
                  />
                </>
              )}
              {(view === "running" || view === "hiking") && (
                <ToolbarButton
                  onClick={() => setUploadModalOpen(true)}
                  icon={<UploadIcon />}
                  label="Upload TCX"
                />
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <ToolbarButton
                onClick={() => setView("overview")}
                icon={<ActivityIcon />}
                label="Overview"
                active={view === "overview"}
              />
              <ToolbarButton
                onClick={() => setView("workouts")}
                icon={<DumbbellIcon />}
                label="Workouts"
                active={view === "workouts"}
              />
              <ToolbarButton
                onClick={() => setView("running")}
                icon={<RunIcon />}
                label="Running"
                active={view === "running"}
              />
              <ToolbarButton
                onClick={() => setView("hiking")}
                icon={<HikingIcon />}
                label="Hiking"
                active={view === "hiking"}
              />
              <ToolbarButton
                onClick={() => setView("steps")}
                icon={<FootprintsIcon />}
                label="Steps"
                active={view === "steps"}
              />
            </div>
          </div>

          {view === "overview" && (
            <ActivitiesOverviewView days={days} distanceUnit={distanceUnit} />
          )}
          {view === "workouts" && <WorkoutsView days={days} displayUnit={displayUnit} />}
          {view === "running" && (
            <RunningView
              days={days}
              uploadModalOpen={uploadModalOpen}
              onCloseUploadModal={() => setUploadModalOpen(false)}
            />
          )}
          {view === "hiking" && (
            <HikingView
              days={days}
              uploadModalOpen={uploadModalOpen}
              onCloseUploadModal={() => setUploadModalOpen(false)}
            />
          )}
          {view === "steps" && <StepsView days={days} />}
        </div>
      </div>

      {logFromTcxOpen && (
        <WorkoutTCXUploadModal
          mode="create"
          onClose={() => setLogFromTcxOpen(false)}
          onUploaded={(workout) => router.push(`/workouts/${workout.id}`)}
        />
      )}
    </main>
  );
}

// --- Toolbar icons -------------------------------------------------------

function ActivityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 6.5v11" />
      <path d="M17.5 6.5v11" />
      <path d="M3.5 9v6" />
      <path d="M20.5 9v6" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="14" cy="5" r="1.6" />
      <path d="M7 21l3-5 3 2 1 3" />
      <path d="M13 13l-1.5-3.5 3-1.5 2.5 2 2 1" />
      <path d="M4 11l3-1 3 1" />
    </svg>
  );
}

function HikingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 20l6-11 4 6 2-3 6 8z" />
      <path d="M7.5 13.5l1.5-2.5 1.5 2.5" />
    </svg>
  );
}

function FootprintsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 16c-.5-2.5-.5-5 .5-7 1-2 3-2 3.5 0 .5 1.5 0 4-.5 6-.5 1.5-3 1.5-3.5 1z" />
      <path d="M4 20.5c0 1 1 1.5 2 1.5s2-.5 2-1.5V18H4v2.5z" />
      <path d="M20 11c.5-2.5.5-5-.5-7-1-2-3-2-3.5 0-.5 1.5 0 4 .5 6 .5 1.5 3 1.5 3.5 1z" />
      <path d="M20 15.5c0 1-1 1.5-2 1.5s-2-.5-2-1.5V13h4v2.5z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

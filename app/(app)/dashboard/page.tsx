"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getDashboardSummary, getMe, type DashboardSummary } from "@/lib/api";
import { adaptDashboard, type DashboardData } from "@/lib/dashboard";
import { compact } from "./_components/compact";
import { Kpi, type KpiDelta } from "./_components/kpi";
import { CommandBar } from "./_components/command-bar";
import { MiniCardSkeleton } from "./_components/mini-card";
import { RecoveryCard } from "./_components/whoop-card";
import {
  RunningCard,
  LiftingCard,
  StepsCard,
  NutritionCard,
  BodyweightCard,
  StreakCard,
} from "./_components/tile-renderer";

/**
 * Dashboard — the command-center surface.
 *
 * A single GET /dashboard/summary feeds a dense KPI strip + a grid of
 * per-domain mini-cards, each deep-linking into its full page. The page
 * is calm power-user density (Linear-earned, not a trading terminal):
 * mono tabular numerals, hairline dividers, status-encoded deltas, and
 * the periwinkle accent reserved for the command bar's active chrome.
 *
 * Data flow mirrors the bodyweight page's fetch+useState pattern: a token
 * guard up front (missing → /login), then getMe → getDashboardSummary
 * keyed on the profile's IANA timezone, with a 401 clearing the token and
 * routing to /login. While the one fetch is in flight the strip + grid
 * render as skeletons rather than a page spinner. The W1 adapter
 * (adaptDashboard) turns the summary into the display view-model; every
 * null section degrades independently to an inviting empty CTA, and a
 * brand-new (isNew) streak reads "start your streak" — never 0 / NaN%.
 */

const DEEP_LINKS = {
  running: "/activities?view=running",
  lifting: "/workouts",
  steps: "/activities?view=steps",
  nutrition: "/nutrition",
  bodyweight: "/bodyweight",
  recovery: "/recovery",
  streak: "/activities",
} as const;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (err: Error) => {
      if (err.message.toLowerCase().includes("401")) {
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
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe(token);
        if (cancelled) return;
        // Anchor day/week windows on the BROWSER's IANA timezone — the same
        // source the nutrition, chat, running, and activities surfaces use.
        // The saved profile tz can be stale/wrong, which made the dashboard's
        // "today" window disagree with the (correct) nutrition page and pull
        // an adjacent day's nutrition entries; the browser zone is the user's
        // actual wall clock.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const summary: DashboardSummary | null = await getDashboardSummary(token, tz);
        if (cancelled) return;
        setData(adaptDashboard(summary, me));
      } catch (err) {
        if (cancelled) return;
        if (handleAuthError(err as Error)) return;
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, handleAuthError]);

  const handleCommand = useCallback(
    (value: string) => {
      router.push(`/chat?prompt=${encodeURIComponent(value)}`);
    },
    [router],
  );

  const loading = data === null && error === null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-3 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-[var(--muted)]">
          Your training at a glance — every tile opens the full view.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {loading ? (
            <>
              <KpiStripSkeleton />
              <CommandBar onSubmit={handleCommand} />
              <CardGrid>
                {Array.from({ length: 6 }).map((_, i) => (
                  <MiniCardSkeleton key={i} />
                ))}
              </CardGrid>
            </>
          ) : data ? (
            <>
              <KpiStrip data={data} />
              <CommandBar onSubmit={handleCommand} />
              <CardGrid>
                <RunningCard section={data.running} href={DEEP_LINKS.running} />
                <LiftingCard section={data.lifting} href={DEEP_LINKS.lifting} />
                <StepsCard section={data.steps} href={DEEP_LINKS.steps} />
                <NutritionCard section={data.nutrition} href={DEEP_LINKS.nutrition} />
                <BodyweightCard section={data.bodyweight} href={DEEP_LINKS.bodyweight} />
                {data.recovery.present && (
                  <RecoveryCard section={data.recovery} href={DEEP_LINKS.recovery} />
                )}
                <StreakCard streak={data.streak} href={DEEP_LINKS.streak} />
              </CardGrid>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// --- KPI strip ----------------------------------------------------

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** Signed-percentage delta → status tone. Up = good, down = bad. Null → no delta. */
function pctDelta(deltaPct: number | null): KpiDelta | null {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const rounded = Math.round(deltaPct);
  if (rounded === 0) return null;
  const sign = rounded > 0 ? "+" : "";
  return { text: `${sign}${rounded}%`, tone: rounded > 0 ? "good" : "bad" };
}

function KpiStrip({ data }: { data: DashboardData }) {
  const { running, lifting, steps, nutrition, bodyweight, streak } = data;

  return (
    <div className="grid grid-cols-2 divide-y divide-[var(--border)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 [&>*]:border-[var(--border)] sm:[&>*]:border-r lg:[&>*:not(:last-child)]:border-r">
      <Kpi
        label="Streak"
        value={streak.isNew ? "—" : compact(streak.weeks)}
        unit={streak.isNew ? "new" : streak.weeks === 1 ? "wk" : "wks"}
      />
      <Kpi
        label="Run"
        discipline="run"
        value={running.present ? running.currentWeek.distance : "—"}
        unit={running.present ? running.unit : undefined}
        delta={running.present ? pctDelta(running.currentWeek.deltaPct) : null}
      />
      <Kpi
        label="Lift"
        discipline="lift"
        value={lifting.present ? compact(lifting.currentWeek.sessions) : "—"}
        unit={
          lifting.present
            ? lifting.currentWeek.sessions === 1
              ? "session"
              : "sessions"
            : undefined
        }
      />
      <Kpi
        label="Steps"
        value={steps.present ? compact(steps.today) : "—"}
        unit={steps.present ? "today" : undefined}
      />
      <Kpi
        label="Fuel"
        value={nutrition.present ? compact(nutrition.today.calories) : "—"}
        unit={nutrition.present ? "kcal" : undefined}
      />
      <Kpi
        label="Weight"
        value={bodyweight.present ? compact(bodyweight.current) : "—"}
        unit={bodyweight.present ? bodyweight.unit : undefined}
      />
    </div>
  );
}

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
          <div className="h-3 w-12 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-5 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getDashboardSummary, getMe, type DashboardSummary } from "@/lib/api";
import {
  adaptDashboard,
  type DashboardData,
  type LiftingView,
  type RunningView,
  type StepsView,
  type BodyweightView,
} from "@/lib/dashboard";
import { compact } from "./_components/compact";
import { formatDuration } from "@/lib/format";
import { Spark } from "./_components/spark";
import { StepsGoalBars } from "./_components/steps-goal-bars";
import { BigNum } from "./_components/big-num";
import { MetaRow } from "./_components/meta-row";
import { MacroBar } from "./_components/macro-bar";
import { Kpi, type KpiDelta } from "./_components/kpi";
import { CommandBar } from "./_components/command-bar";
import { MiniCard, MiniCardEmpty, MiniCardSkeleton } from "./_components/mini-card";

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
                <RunningCard section={data.running} />
                <LiftingCard section={data.lifting} />
                <StepsCard section={data.steps} />
                <NutritionCard section={data.nutrition} />
                <BodyweightCard section={data.bodyweight} />
                <StreakCard streak={data.streak} />
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

// --- Domain cards -------------------------------------------------

function RunningCard({ section }: { section: DashboardData["running"] }) {
  if (!section.present) {
    return (
      <MiniCard title="Running" href={DEEP_LINKS.running}>
        <MiniCardEmpty cta="Import a run to start tracking" />
      </MiniCard>
    );
  }
  const v: RunningView = section;
  return (
    <MiniCard title="Running" href={DEEP_LINKS.running}>
      <BigNum value={v.currentWeek.distance} suffix={`${v.unit} this week`} />
      <Spark points={v.spark.points} className="h-7 w-full text-[var(--discipline-run-dot)]" />
      <MetaRow
        items={[
          { label: "runs", value: compact(v.currentWeek.runCount) },
          { label: "pace", value: v.pace },
          { label: "last", value: v.latestRun ? `${v.latestRun.distance} ${v.unit}` : null },
        ]}
      />
    </MiniCard>
  );
}

function LiftingCard({ section }: { section: DashboardData["lifting"] }) {
  if (!section.present) {
    return (
      <MiniCard title="Lifting" href={DEEP_LINKS.lifting}>
        <MiniCardEmpty cta="Log a workout to start tracking" />
      </MiniCard>
    );
  }
  const v: LiftingView = section;
  return (
    <MiniCard title="Lifting" href={DEEP_LINKS.lifting}>
      <BigNum
        value={compact(v.currentWeek.sessions)}
        suffix={v.currentWeek.sessions === 1 ? "session this week" : "sessions this week"}
      />
      <Spark points={v.spark} className="h-7 w-full text-[var(--discipline-lift-dot)]" />
      <MetaRow
        items={[
          { label: "time", value: formatDuration(v.currentWeek.durationSeconds) },
          { label: "sets", value: compact(v.currentWeek.sets) },
          { label: "PRs", value: compact(v.currentWeek.prs) },
          {
            label: "1RM",
            value: v.headline1rm ? `${compact(v.headline1rm.value)} ${v.headline1rm.unit}` : null,
          },
        ]}
      />
    </MiniCard>
  );
}

function StepsCard({ section }: { section: DashboardData["steps"] }) {
  if (!section.present) {
    return (
      <MiniCard title="Steps" href={DEEP_LINKS.steps}>
        <MiniCardEmpty cta="Log your steps to start tracking" />
      </MiniCard>
    );
  }
  const v: StepsView = section;
  return (
    <MiniCard title="Steps" href={DEEP_LINKS.steps}>
      <BigNum value={compact(v.today)} suffix="today" />
      <StepsGoalBars spark={v.spark} avg={v.avg} goal={v.goal} />
      <MetaRow
        items={[
          { label: "avg", value: compact(v.avg) },
          { label: "goal", value: v.goal !== null ? compact(v.goal) : "set a goal" },
        ]}
      />
    </MiniCard>
  );
}

function NutritionCard({ section }: { section: DashboardData["nutrition"] }) {
  if (!section.present) {
    return (
      <MiniCard title="Nutrition" href={DEEP_LINKS.nutrition}>
        <MiniCardEmpty cta="Log a meal to start tracking" />
      </MiniCard>
    );
  }
  const { today, goals } = section;
  return (
    <MiniCard title="Nutrition" href={DEEP_LINKS.nutrition}>
      <BigNum value={compact(today.calories)} suffix="kcal today" />
      <div className="flex flex-col gap-2">
        <MacroBar kind="protein" value={today.protein_g} goal={goals ? goals.protein_g : null} />
        <MacroBar kind="carbs" value={today.carbs_g} goal={goals ? goals.carbs_g : null} />
        <MacroBar kind="fat" value={today.fat_g} goal={goals ? goals.fat_g : null} />
      </div>
    </MiniCard>
  );
}

function BodyweightCard({ section }: { section: DashboardData["bodyweight"] }) {
  if (!section.present) {
    return (
      <MiniCard title="Bodyweight" href={DEEP_LINKS.bodyweight}>
        <MiniCardEmpty cta="Log a reading to start tracking" />
      </MiniCard>
    );
  }
  const v: BodyweightView = section;
  const rate =
    v.ratePerWeek !== null && Number.isFinite(v.ratePerWeek)
      ? `${v.ratePerWeek > 0 ? "+" : ""}${v.ratePerWeek.toFixed(1)} ${v.unit}/wk`
      : null;
  return (
    <MiniCard title="Bodyweight" href={DEEP_LINKS.bodyweight}>
      <BigNum value={compact(v.current)} suffix={v.unit} />
      <Spark points={v.spark} className="h-7 w-full text-[var(--muted)]" />
      <MetaRow
        items={[
          { label: "rate", value: rate },
          {
            label: "goal",
            value: v.goal ? `${compact(v.goal.weight)} ${v.goal.unit}` : "set a goal",
          },
        ]}
      />
    </MiniCard>
  );
}

function StreakCard({ streak }: { streak: DashboardData["streak"] }) {
  if (streak.isNew) {
    return (
      <MiniCard title="Streak" href={DEEP_LINKS.streak}>
        <BigNum value="—" suffix="start your streak" />
        <p className="text-sm text-[var(--muted)]">Log any activity to begin a weekly streak.</p>
      </MiniCard>
    );
  }
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <MiniCard title="Streak" href={DEEP_LINKS.streak}>
      <BigNum value={compact(streak.weeks)} suffix={streak.weeks === 1 ? "week" : "weeks"} />
      <div className="flex items-center gap-1.5">
        {dayLabels.map((label, i) => {
          const active = streak.week[i] ?? false;
          return (
            <span
              key={i}
              aria-label={`${label}${active ? " active" : ""}`}
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium"
              style={{
                backgroundColor: active ? "var(--accent-soft)" : "var(--surface-2)",
                color: active ? "var(--accent)" : "var(--faint)",
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
      <MetaRow items={[{ label: "this week", value: `${streak.activeDaysThisWeek}/7 days` }]} />
    </MiniCard>
  );
}

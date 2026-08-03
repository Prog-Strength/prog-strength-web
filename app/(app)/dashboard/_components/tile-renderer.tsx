/**
 * TileCard — the exhaustive dashboard tile renderer.
 *
 * A single `switch` over `TileId` maps every catalog id to its domain card,
 * threading the matching section from `DashboardData` and the catalog `href`.
 * The `never` default is the SOW's compile-time exhaustiveness guard: adding a
 * new `TileId` without a case here is a TYPE error, so a tile can never ship
 * without a card.
 *
 * The five original page-local cards (lifting/steps/nutrition/bodyweight/
 * streak) live here now — moved out of `page.tsx` and refactored to take an
 * explicit `href` prop (matching the walking/cycling/hiking/recovery
 * signatures) instead of reaching into the page's `DEEP_LINKS`. Their bodies
 * are otherwise unchanged. They are re-exported so `page.tsx` (pre-W6) can keep
 * importing them.
 *
 * The recovery FAMILY — recovery, hrv_balance, morning_vitals, recovery_trend,
 * recovery_log — are the tiles whose section can be "enabled but not present"
 * (the user added the tile but hasn't connected Whoop). All five read the one
 * shared `recovery` section; when enabled-but-absent each family id renders
 * its own titled `RecoveryConnectCard` connect CTA. The other cards each own
 * their `!section.present` empty state internally.
 *
 * The running FAMILY — running, running_log, running_effort,
 * running_vertical — is the same pattern applied to running: four tiles
 * reading the one shared `running` section, each rendering its own titled
 * `RunningEmptyCard` CTA when the section is absent. The retired page-local
 * `RunningCard` (a single spark-less bridge card) now lives under `./running/`
 * as `LoadRampCard`, `WeekLogCard`, `EffortHeartCard`, and `VerticalGainCard`.
 */
"use client";

import { type TileId, tileEntry } from "@/lib/dashboard-tiles";
import type {
  DashboardData,
  LiftingView,
  StepsView,
  BodyweightView,
  BloodPressureView,
} from "@/lib/dashboard";
import { BP_CATEGORIES } from "@/lib/blood-pressure";
import { compact } from "./compact";
import { formatDuration } from "@/lib/format";
import { Spark } from "./spark";
import { StepsGoalBars } from "./steps-goal-bars";
import { BigNum } from "./big-num";
import { MetaRow } from "./meta-row";
import { MacroBar } from "./macro-bar";
import { MiniCard, MiniCardEmpty } from "./mini-card";
import { WalkingCard } from "./walking-card";
import { CyclingCard } from "./cycling-card";
import { HikingCard } from "./hiking-card";
import { RecoveryConnectCard } from "./recovery/connect-card";
import { ReadinessVerdictCard } from "./recovery/readiness-verdict";
import { HrvBalanceCard } from "./recovery/balance-band";
import { MorningVitalsCard } from "./recovery/three-dial-vitals";
import { TrendRailCard } from "./recovery/trend-rail";
import { MorningLedgerCard } from "./recovery/morning-ledger";
import { LoadRampCard } from "./running/load-ramp";
import { WeekLogCard } from "./running/week-log";
import { EffortHeartCard } from "./running/effort-heart";
import { VerticalGainCard } from "./running/vertical-gain";
import { RunningEmptyCard } from "./running/empty-card";

export function LiftingCard({
  section,
  href,
}: {
  section: DashboardData["lifting"];
  href: string;
}) {
  if (!section.present) {
    return (
      <MiniCard title="Lifting" href={href}>
        <MiniCardEmpty cta="Log a workout to start tracking" />
      </MiniCard>
    );
  }
  const v: LiftingView = section;
  return (
    <MiniCard title="Lifting" href={href}>
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

export function StepsCard({ section, href }: { section: DashboardData["steps"]; href: string }) {
  if (!section.present) {
    return (
      <MiniCard title="Steps" href={href}>
        <MiniCardEmpty cta="Log your steps to start tracking" />
      </MiniCard>
    );
  }
  const v: StepsView = section;
  return (
    <MiniCard title="Steps" href={href}>
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

export function NutritionCard({
  section,
  href,
}: {
  section: DashboardData["nutrition"];
  href: string;
}) {
  if (!section.present) {
    return (
      <MiniCard title="Nutrition" href={href}>
        <MiniCardEmpty cta="Log a meal to start tracking" />
      </MiniCard>
    );
  }
  const { today, goals } = section;
  return (
    <MiniCard title="Nutrition" href={href}>
      <BigNum value={compact(today.calories)} suffix="kcal today" />
      <div className="flex flex-col gap-2">
        <MacroBar kind="protein" value={today.protein_g} goal={goals ? goals.protein_g : null} />
        <MacroBar kind="carbs" value={today.carbs_g} goal={goals ? goals.carbs_g : null} />
        <MacroBar kind="fat" value={today.fat_g} goal={goals ? goals.fat_g : null} />
      </div>
    </MiniCard>
  );
}

export function BodyweightCard({
  section,
  href,
}: {
  section: DashboardData["bodyweight"];
  href: string;
}) {
  if (!section.present) {
    return (
      <MiniCard title="Bodyweight" href={href}>
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
    <MiniCard title="Bodyweight" href={href}>
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

export function StreakCard({ streak, href }: { streak: DashboardData["streak"]; href: string }) {
  if (streak.isNew) {
    return (
      <MiniCard title="Streak" href={href}>
        <BigNum value="—" suffix="start your streak" />
        <p className="text-sm text-[var(--muted)]">Log any activity to begin a weekly streak.</p>
      </MiniCard>
    );
  }
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <MiniCard title="Streak" href={href}>
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

/** Compact "time since" for the latest reading — a short local date. */
function readingDate(measuredAt: string): string {
  const d = new Date(measuredAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BloodPressureCard({
  section,
  href,
}: {
  section: DashboardData["bloodPressure"];
  href: string;
}) {
  if (!section.present) {
    return (
      <MiniCard title="Blood Pressure" href={href}>
        <MiniCardEmpty cta="Log your first reading" />
      </MiniCard>
    );
  }
  const v: BloodPressureView = section;
  return (
    <MiniCard title="Blood Pressure" href={href}>
      <BigNum value={`${v.latest.systolic}/${v.latest.diastolic}`} />
      <Spark
        points={v.systolicSpark}
        points2={v.diastolicSpark}
        className="h-7 w-full text-[var(--accent)]"
        accent2="var(--muted)"
      />
      <MetaRow
        items={[
          { label: "category", value: BP_CATEGORIES[v.category].label },
          {
            label: "30d avg",
            value: v.avg30 ? `${v.avg30.systolic}/${v.avg30.diastolic}` : null,
          },
          { label: "last", value: readingDate(v.latest.measured_at) },
        ]}
      />
    </MiniCard>
  );
}

/**
 * Render one tile by id. The exhaustive `switch` is the compile-time guard: a
 * new `TileId` with no case makes the `never` default fail to type-check.
 */
export function TileCard({ id, data }: { id: TileId; data: DashboardData }) {
  const href = tileEntry(id).href;
  switch (id) {
    case "running":
      return data.running.present ? (
        <LoadRampCard section={data.running} href={href} />
      ) : (
        <RunningEmptyCard title="Training Load" href={href} />
      );
    case "running_log":
      return data.running.present ? (
        <WeekLogCard section={data.running} href={href} />
      ) : (
        <RunningEmptyCard title="Runs This Week" href={href} />
      );
    case "running_effort":
      return data.running.present ? (
        <EffortHeartCard section={data.running} href={href} />
      ) : (
        <RunningEmptyCard title="Run Effort" href={href} />
      );
    case "running_vertical":
      return data.running.present ? (
        <VerticalGainCard section={data.running} href={href} />
      ) : (
        <RunningEmptyCard title="Vertical Gain" href={href} />
      );
    case "walking":
      return <WalkingCard section={data.walking} href={href} />;
    case "cycling":
      return <CyclingCard section={data.cycling} href={href} />;
    case "hiking":
      return <HikingCard section={data.hiking} href={href} />;
    case "lifting":
      return <LiftingCard section={data.lifting} href={href} />;
    case "steps":
      return <StepsCard section={data.steps} href={href} />;
    case "nutrition":
      return <NutritionCard section={data.nutrition} href={href} />;
    case "bodyweight":
      return <BodyweightCard section={data.bodyweight} href={href} />;
    case "blood_pressure":
      return <BloodPressureCard section={data.bloodPressure} href={href} />;
    case "recovery":
      return data.recovery.present ? (
        <ReadinessVerdictCard section={data.recovery} href={href} />
      ) : (
        <RecoveryConnectCard title="Recovery" href={href} />
      );
    case "hrv_balance":
      return data.recovery.present ? (
        <HrvBalanceCard section={data.recovery} href={href} />
      ) : (
        <RecoveryConnectCard title="HRV Balance" href={href} />
      );
    case "morning_vitals":
      return data.recovery.present ? (
        <MorningVitalsCard section={data.recovery} href={href} />
      ) : (
        <RecoveryConnectCard title="Morning Vitals" href={href} />
      );
    case "recovery_trend":
      return data.recovery.present ? (
        <TrendRailCard section={data.recovery} href={href} />
      ) : (
        <RecoveryConnectCard title="Recovery Trend" href={href} />
      );
    case "recovery_log":
      return data.recovery.present ? (
        <MorningLedgerCard section={data.recovery} href={href} />
      ) : (
        <RecoveryConnectCard title="Recovery Log" href={href} />
      );
    case "streak":
      return <StreakCard streak={data.streak} href={href} />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

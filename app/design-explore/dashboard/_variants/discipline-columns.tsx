"use client";

/**
 * IDIOM: discipline-columns — Strava's multi-pane dashboard.
 *
 * Composition: parity ACROSS disciplines. The page is organized into columns
 * by discipline — a Running column, a Lifting column, and a Health column
 * (steps · nutrition · bodyweight) — each with its headline metric and a
 * mini-trend. The chat bar spans the top above all columns. Hierarchy comes
 * from side-by-side STRUCTURE, not one hero number: the runner-who-also-lifts
 * sees both worlds at once. Reflows to stacked sections on mobile.
 *
 * Distinct by: column layout with per-discipline tinted headers (the run /
 * lift discipline hues earn their keep here), repeated medium headlines at
 * equal rank, a vertical-gutter spacing rhythm. Each discipline gets its own
 * home on one screen.
 *
 * In-system: v0.4 tokens only — periwinkle chat bar as app-chrome; the
 * --discipline-run-* / --discipline-lift-* token sets used exactly as the
 * system intends (activity owns its hue), Health column stays neutral.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEEP_LINKS, type DashboardData } from "../_fixtures/data";

export function DisciplineColumnsVariant({
  data,
  loading,
}: {
  data: DashboardData;
  loading: boolean;
}) {
  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-[var(--muted)]">Good afternoon, {data.greetingName}.</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight">Your disciplines</h2>
        </div>
        <StreakRibbon weeks={data.streak.weeks} active={data.streak.activeDaysThisWeek} />
      </div>

      <ChatSpan />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Column title="Running" tint="run" href={DEEP_LINKS.running}>
          {loading ? (
            <ColSkeleton />
          ) : !data.running ? (
            <ColEmpty cta="Log your first run" hint="Distance, pace and weekly trend land here." />
          ) : (
            <RunningBody r={data.running} />
          )}
        </Column>

        <Column title="Lifting" tint="lift" href={DEEP_LINKS.lifting}>
          {loading ? (
            <ColSkeleton />
          ) : !data.lifting ? (
            <ColEmpty cta="Start a workout" hint="Volume, sets and PRs build this column." />
          ) : (
            <LiftingBody l={data.lifting} />
          )}
        </Column>

        <Column title="Health" tint="neutral" href={DEEP_LINKS.steps}>
          <HealthBody data={data} loading={loading} />
        </Column>
      </div>
    </div>
  );
}

// --- Column shell ---------------------------------------------------------

const TINTS = {
  run: {
    bg: "var(--discipline-run-bg)",
    fg: "var(--discipline-run-fg)",
    dot: "var(--discipline-run-dot)",
  },
  lift: {
    bg: "var(--discipline-lift-bg)",
    fg: "var(--discipline-lift-fg)",
    dot: "var(--discipline-lift-dot)",
  },
  neutral: { bg: "var(--surface-2)", fg: "var(--foreground)", dot: "var(--faint)" },
} as const;

function Column({
  title,
  tint,
  href,
  children,
}: {
  title: string;
  tint: keyof typeof TINTS;
  href: string;
  children: React.ReactNode;
}) {
  const t = TINTS[tint];
  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <a
        href={href}
        className="flex items-center justify-between px-4 py-3 transition hover:brightness-110"
        style={{ backgroundColor: t.bg }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.fg }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.dot }} />
          {title}
        </span>
        <span className="text-xs" style={{ color: t.fg }}>
          View →
        </span>
      </a>
      <div className="flex-1 px-4 py-4">{children}</div>
    </section>
  );
}

function ColEmpty({ cta, hint }: { cta: string; hint: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-start justify-center">
      <p className="text-sm text-[var(--muted)]">{hint}</p>
      <p className="mt-2 text-sm font-medium text-[var(--accent)]">{cta} →</p>
    </div>
  );
}

function ColSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-9 w-28 rounded bg-[var(--surface-3)]" />
      <div className="h-3 w-40 rounded bg-[var(--surface-2)]" />
      <div className="mt-4 h-10 w-full rounded bg-[var(--surface-2)]" />
    </div>
  );
}

// --- Column bodies --------------------------------------------------------

function RunningBody({ r }: { r: NonNullable<DashboardData["running"]> }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">
          {r.weekDistanceMi}
        </span>
        <span className="text-sm text-[var(--muted)]">mi this week</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">{r.runCount} runs</span>
        {r.deltaPct != null && (
          <span className={r.deltaPct >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
            {r.deltaPct >= 0 ? "+" : ""}
            {r.deltaPct}% vs last wk
          </span>
        )}
      </div>
      <Sparkline points={r.spark} color="var(--discipline-run-dot)" />
      <Row label="Avg pace" value={r.avgPace ?? "—"} />
      {r.latest && (
        <Row
          label="Latest"
          value={`${r.latest.name} · ${r.latest.distanceMi} mi · ${r.latest.duration}`}
        />
      )}
    </div>
  );
}

function LiftingBody({ l }: { l: NonNullable<DashboardData["lifting"]> }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">{l.weekTime}</span>
        <span className="text-sm text-[var(--muted)]">this week</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">
          {l.sessions} sessions · {l.sets} sets
        </span>
        {l.prs > 0 && <span className="font-medium text-[var(--accent)]">{l.prs} PRs</span>}
      </div>
      <Sparkline points={l.spark} color="var(--discipline-lift-dot)" />
      {l.bestE1rm && <Row label="Best est-1RM" value={`${l.bestE1rm.lift} ${l.bestE1rm.value}`} />}
      {l.topSession && <Row label="Top session" value={l.topSession} />}
    </div>
  );
}

function HealthBody({ data, loading }: { data: DashboardData; loading: boolean }) {
  if (loading) return <ColSkeleton />;
  const { steps, nutrition, bodyweight } = data;
  if (!steps && !nutrition && !bodyweight)
    return <ColEmpty cta="Set a step goal" hint="Steps, nutrition and bodyweight roll up here." />;
  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      <MiniRow
        label="Steps"
        value={steps ? steps.avg.toLocaleString() : null}
        sub={steps?.goal ? `${Math.round((steps.avg / steps.goal) * 100)}% of goal` : "Set a goal"}
      />
      <MiniRow
        label="Nutrition"
        value={nutrition ? `${nutrition.calories.toLocaleString()} kcal` : null}
        sub={
          nutrition
            ? `protein ${nutrition.proteinG}/${nutrition.proteinGoal ?? "—"}g`
            : "Log today’s meals"
        }
      />
      <MiniRow
        label="Bodyweight"
        value={bodyweight ? `${bodyweight.current} ${bodyweight.unit}` : null}
        sub={
          bodyweight
            ? `${bodyweight.ratePerWeek > 0 ? "+" : ""}${bodyweight.ratePerWeek}/wk${bodyweight.goal ? ` → ${bodyweight.goal}` : ""}`
            : "Log your weight"
        }
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </span>
      <span className="truncate text-right text-xs tabular-nums text-[var(--muted)]">{value}</span>
    </div>
  );
}

function MiniRow({ label, value, sub }: { label: string; value: string | null; sub: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {label}
        </span>
        {value ? (
          <span className="text-lg font-semibold tabular-nums tracking-[-0.03em]">{value}</span>
        ) : (
          <span className="text-sm text-[var(--faint)]">—</span>
        )}
      </div>
      <p className={`mt-0.5 text-xs ${value ? "text-[var(--muted)]" : "text-[var(--accent)]"}`}>
        {sub}
      </p>
    </div>
  );
}

// --- Bits -----------------------------------------------------------------

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 200;
  const h = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-9 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StreakRibbon({ weeks, active }: { weeks: number; active: number }) {
  if (weeks === 0)
    return (
      <span className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
        No streak yet — start today
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-xs">
      <span className="font-semibold text-[var(--accent)]">{weeks}-week streak</span>
      <span className="text-[var(--muted)]">{active}/7 this week</span>
    </span>
  );
}

function ChatSpan() {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/chat?prompt=${encodeURIComponent(value.trim())}`);
      }}
      className="mt-5 flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
        Coach
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask across every discipline — “am I overtraining?”"
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg)]"
      >
        Ask
      </button>
    </form>
  );
}

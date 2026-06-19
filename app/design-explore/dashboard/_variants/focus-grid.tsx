"use client";

/**
 * IDIOM: focus-grid — Garmin Connect "In Focus".
 *
 * Composition: a responsive grid of EQUAL-WEIGHT metric cards, one per domain
 * (Streak · Running · Lifting · Steps · Nutrition · Bodyweight). No domain
 * wins — the mosaic itself is the hero. The chat bar is a prominent hero
 * strip across the top. Each card is a self-contained glance (headline figure,
 * a tiny trend, a link in) and carries its OWN empty state, so a sparse user
 * sees an inviting board rather than gaps.
 *
 * Distinct by: uniform card grid (one size, generous gap), a single large
 * headline per card, airy card-forward spacing rhythm. The "everything at
 * once, most legible" executive overview.
 *
 * In-system: v0.4 tokens only — near-black ramp, periwinkle as app-chrome
 * (chat strip + active state), run/lift discipline hues on their cards.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEEP_LINKS, WEEKDAYS, type DashboardData } from "../_fixtures/data";

export function FocusGridVariant({ data, loading }: { data: DashboardData; loading: boolean }) {
  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <p className="text-sm text-[var(--muted)]">Good afternoon, {data.greetingName}.</p>
      <h2 className="mt-0.5 text-xl font-semibold tracking-tight">In focus</h2>

      <ChatStrip />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StreakCard data={data} loading={loading} />
        <RunningCard data={data} loading={loading} />
        <LiftingCard data={data} loading={loading} />
        <StepsCard data={data} loading={loading} />
        <NutritionCard data={data} loading={loading} />
        <BodyweightCard data={data} loading={loading} />
      </div>
    </div>
  );
}

function ChatStrip() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    router.push(`/chat?prompt=${encodeURIComponent(value.trim())}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-5 flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-3"
    >
      <SparkleIcon className="h-5 w-5 shrink-0 text-[var(--accent)]" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask your coach anything — “how’s my bench trending?”"
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

// --- Card shell -----------------------------------------------------------

function Card({
  label,
  href,
  accent,
  children,
}: {
  label: string;
  href: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group flex min-h-[148px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: accent ?? "var(--faint)" }}
        >
          {label}
        </span>
        <ArrowIcon className="h-3.5 w-3.5 text-[var(--faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--muted)]" />
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-end">{children}</div>
    </a>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.03em]">
      {children}
    </p>
  );
}

function Sub({ children, tone }: { children: React.ReactNode; tone?: "up" | "down" }) {
  const color =
    tone === "up"
      ? "text-[var(--success)]"
      : tone === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";
  return <p className={`mt-1.5 text-xs tabular-nums ${color}`}>{children}</p>;
}

function Empty({ cta }: { cta: string }) {
  return (
    <div>
      <p className="text-sm text-[var(--muted)]">No data yet</p>
      <p className="mt-1.5 text-xs font-medium text-[var(--accent)]">{cta} →</p>
    </div>
  );
}

function Skel() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-24 rounded bg-[var(--surface-3)]" />
      <div className="mt-2 h-3 w-16 rounded bg-[var(--surface-2)]" />
    </div>
  );
}

// --- Domain cards ---------------------------------------------------------

function StreakCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const s = data.streak;
  return (
    <Card label="Streak" href={DEEP_LINKS.streak} accent="var(--accent)">
      {loading ? (
        <Skel />
      ) : s.weeks === 0 ? (
        <Empty cta="Log an activity to start" />
      ) : (
        <>
          <Headline>
            {s.weeks}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">wk</span>
          </Headline>
          <div className="mt-3 flex items-center gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                title={d}
                className={`h-2 w-2 rounded-full ${
                  s.week[i] ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]"
                }`}
              />
            ))}
            <span className="ml-1 text-xs text-[var(--muted)]">
              {s.activeDaysThisWeek}/7 this week
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function RunningCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const r = data.running;
  return (
    <Card label="Running" href={DEEP_LINKS.running} accent="var(--discipline-run-fg)">
      {loading ? (
        <Skel />
      ) : !r ? (
        <Empty cta="Log your first run" />
      ) : (
        <>
          <Headline>
            {r.weekDistanceMi}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">mi</span>
          </Headline>
          <Sub tone={r.deltaPct != null && r.deltaPct >= 0 ? "up" : "down"}>
            {r.runCount} runs ·{" "}
            {r.deltaPct != null ? `${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct}%` : "—"} vs last wk
          </Sub>
        </>
      )}
    </Card>
  );
}

function LiftingCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const l = data.lifting;
  return (
    <Card label="Lifting" href={DEEP_LINKS.lifting} accent="var(--discipline-lift-fg)">
      {loading ? (
        <Skel />
      ) : !l ? (
        <Empty cta="Start a workout" />
      ) : (
        <>
          <Headline>{l.weekTime}</Headline>
          <Sub>
            {l.sessions} sessions · {l.sets} sets
            {l.prs > 0 ? <span className="ml-1 text-[var(--accent)]">· {l.prs} PRs</span> : null}
          </Sub>
        </>
      )}
    </Card>
  );
}

function StepsCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const st = data.steps;
  const pct = st && st.goal ? Math.round((st.avg / st.goal) * 100) : null;
  return (
    <Card label="Steps" href={DEEP_LINKS.steps}>
      {loading ? (
        <Skel />
      ) : !st ? (
        <Empty cta="Connect steps" />
      ) : (
        <>
          <Headline>{st.avg.toLocaleString()}</Headline>
          <Sub>
            {pct != null ? `${pct}% of ${st.goal!.toLocaleString()} goal` : "Set a step goal"}
          </Sub>
        </>
      )}
    </Card>
  );
}

function NutritionCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const n = data.nutrition;
  return (
    <Card label="Nutrition" href={DEEP_LINKS.nutrition}>
      {loading ? (
        <Skel />
      ) : !n ? (
        <Empty cta="Log today’s meals" />
      ) : (
        <>
          <Headline>
            {n.calories.toLocaleString()}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">kcal</span>
          </Headline>
          <Sub>
            {n.calorieGoal ? `of ${n.calorieGoal.toLocaleString()} · ` : ""}
            protein {n.proteinG}/{n.proteinGoal ?? "—"}g
          </Sub>
        </>
      )}
    </Card>
  );
}

function BodyweightCard({ data, loading }: { data: DashboardData; loading: boolean }) {
  const b = data.bodyweight;
  return (
    <Card label="Bodyweight" href={DEEP_LINKS.bodyweight}>
      {loading ? (
        <Skel />
      ) : !b ? (
        <Empty cta="Log your weight" />
      ) : (
        <>
          <Headline>
            {b.current}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">{b.unit}</span>
          </Headline>
          <Sub tone={b.ratePerWeek <= 0 ? "up" : "down"}>
            {b.ratePerWeek > 0 ? "+" : ""}
            {b.ratePerWeek}/wk{b.goal ? ` · goal ${b.goal}` : ""}
          </Sub>
        </>
      )}
    </Card>
  );
}

// --- Icons ----------------------------------------------------------------

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

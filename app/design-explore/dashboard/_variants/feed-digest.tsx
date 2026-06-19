"use client";

/**
 * IDIOM: feed-digest — Strava feed / The Athletic morning briefing.
 *
 * Composition: a prioritized, mobile-first VERTICAL digest. The chat bar
 * leads; then a single, narrow, relevance-ordered column — streak → today's
 * activity → this week's running → this week's lifting → nutrition today →
 * bodyweight trend — each a compact row that SAYS WHAT MATTERS in a line and
 * links in. Editorial, most-important-first, reads top-to-bottom like a
 * briefing. The empty state becomes a friendly "here's how to start"
 * checklist rather than a wall of zeros.
 *
 * Distinct by: a single narrow reading column, a leading editorial sentence
 * per row (prose, not a stat grid), a consistent top-to-bottom rhythm with
 * hairline dividers. "Open the app, scroll once, you're caught up."
 *
 * In-system: v0.4 tokens only — periwinkle chat lead + accents; discipline
 * dots mark running/lifting rows; calm near-black field throughout.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEEP_LINKS, type DashboardData } from "../_fixtures/data";

export function FeedDigestVariant({ data, loading }: { data: DashboardData; loading: boolean }) {
  const empty =
    !data.running && !data.lifting && !data.steps && !data.nutrition && !data.bodyweight;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-md">
        <p className="text-sm text-[var(--muted)]">Good afternoon, {data.greetingName}.</p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight">Today’s briefing</h2>

        <ChatLead />

        {loading ? (
          <FeedSkeleton />
        ) : empty && data.streak.weeks === 0 ? (
          <StartChecklist />
        ) : (
          <div className="mt-5 flex flex-col divide-y divide-[var(--border)]">
            <StreakRow data={data} />
            {data.lifting?.prs ? (
              <FeedRow
                href={DEEP_LINKS.lifting}
                dot="var(--discipline-lift-dot)"
                kicker="Milestone"
                lead={`${data.lifting.prs} new personal record${data.lifting.prs > 1 ? "s" : ""} this week.`}
                detail={
                  data.lifting.bestE1rm
                    ? `Headed by ${data.lifting.bestE1rm.lift} at ${data.lifting.bestE1rm.value} est-1RM.`
                    : undefined
                }
              />
            ) : null}
            {data.running && (
              <FeedRow
                href={DEEP_LINKS.running}
                dot="var(--discipline-run-dot)"
                kicker="Running"
                lead={`${data.running.weekDistanceMi} mi across ${data.running.runCount} runs this week.`}
                detail={`${
                  data.running.deltaPct != null
                    ? `${data.running.deltaPct >= 0 ? "Up" : "Down"} ${Math.abs(data.running.deltaPct)}% on last week`
                    : "First week of running"
                }${data.running.avgPace ? ` · avg ${data.running.avgPace}` : ""}.`}
                tone={data.running.deltaPct != null && data.running.deltaPct >= 0 ? "up" : "down"}
              />
            )}
            {data.lifting && (
              <FeedRow
                href={DEEP_LINKS.lifting}
                dot="var(--discipline-lift-dot)"
                kicker="Lifting"
                lead={`${data.lifting.weekTime} of training over ${data.lifting.sessions} sessions.`}
                detail={`${data.lifting.sets} working sets logged${data.lifting.topSession ? ` · ${data.lifting.topSession}` : ""}.`}
              />
            )}
            {data.steps && (
              <FeedRow
                href={DEEP_LINKS.steps}
                dot="var(--faint)"
                kicker="Steps"
                lead={`${data.steps.today.toLocaleString()} steps today.`}
                detail={
                  data.steps.goal
                    ? `Averaging ${data.steps.avg.toLocaleString()} — ${Math.round((data.steps.avg / data.steps.goal) * 100)}% of your ${data.steps.goal.toLocaleString()} goal.`
                    : `Averaging ${data.steps.avg.toLocaleString()}. Set a goal to track attainment.`
                }
              />
            )}
            {data.nutrition && (
              <FeedRow
                href={DEEP_LINKS.nutrition}
                dot="var(--faint)"
                kicker="Nutrition"
                lead={`${data.nutrition.calories.toLocaleString()}${data.nutrition.calorieGoal ? ` / ${data.nutrition.calorieGoal.toLocaleString()}` : ""} kcal today.`}
                detail={`Protein ${data.nutrition.proteinG}/${data.nutrition.proteinGoal ?? "—"}g${
                  data.nutrition.proteinGoal && data.nutrition.proteinG < data.nutrition.proteinGoal
                    ? " — a little under, get a protein-rich dinner in."
                    : "."
                }`}
              />
            )}
            {data.bodyweight && (
              <FeedRow
                href={DEEP_LINKS.bodyweight}
                dot="var(--faint)"
                kicker="Bodyweight"
                lead={`${data.bodyweight.current} ${data.bodyweight.unit}, trending ${data.bodyweight.ratePerWeek > 0 ? "+" : ""}${data.bodyweight.ratePerWeek}/wk.`}
                detail={
                  data.bodyweight.goal
                    ? `On pace toward your ${data.bodyweight.goal} ${data.bodyweight.unit} goal.`
                    : "Set a goal to see your pace."
                }
                tone={data.bodyweight.ratePerWeek <= 0 ? "up" : "down"}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatLead() {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/chat?prompt=${encodeURIComponent(value.trim())}`);
      }}
      className="mt-5 rounded-[var(--radius-card)] border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3"
    >
      <p className="mb-2 px-1 text-xs font-medium text-[var(--accent)]">
        Start with a question for your coach
      </p>
      <div className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface)] px-4 py-2.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="“What should I focus on today?”"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1 text-xs font-semibold text-[var(--accent-fg)]"
        >
          Ask
        </button>
      </div>
    </form>
  );
}

function StreakRow({ data }: { data: DashboardData }) {
  const s = data.streak;
  return (
    <a href={DEEP_LINKS.streak} className="group flex items-center gap-3 py-4 first:pt-5">
      <FlameIcon active={s.weeks > 0} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          Streak
        </p>
        <p className="mt-0.5 text-sm leading-snug text-[var(--foreground)]">
          {s.weeks > 0 ? (
            <>
              You’re on a <span className="font-semibold">{s.weeks}-week</span> active streak.
            </>
          ) : (
            "No streak yet — one activity today starts it."
          )}
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {s.activeDaysThisWeek}/7 active days this week.
        </p>
      </div>
      <Chevron />
    </a>
  );
}

function FeedRow({
  href,
  dot,
  kicker,
  lead,
  detail,
  tone,
}: {
  href: string;
  dot: string;
  kicker: string;
  lead: string;
  detail?: string;
  tone?: "up" | "down";
}) {
  const toneColor =
    tone === "up"
      ? "text-[var(--success)]"
      : tone === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";
  return (
    <a href={href} className="group flex items-start gap-3 py-4">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {kicker}
        </p>
        <p className="mt-0.5 text-sm leading-snug tabular-nums text-[var(--foreground)]">{lead}</p>
        {detail && <p className={`mt-0.5 text-xs leading-snug ${toneColor}`}>{detail}</p>}
      </div>
      <Chevron />
    </a>
  );
}

function StartChecklist() {
  const items = [
    { label: "Log your first workout", href: DEEP_LINKS.lifting },
    { label: "Add a run", href: DEEP_LINKS.running },
    { label: "Set a step goal", href: DEEP_LINKS.steps },
    { label: "Log today’s meals", href: DEEP_LINKS.nutrition },
    { label: "Record your bodyweight", href: DEEP_LINKS.bodyweight },
  ];
  return (
    <div className="mt-5">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Welcome to Prog Strength. Your briefing fills in as you log — here’s how to start.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--accent-line)] hover:bg-[var(--surface-2)]"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--faint)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </span>
              <span className="flex-1 text-sm text-[var(--foreground)]">{it.label}</span>
              <Chevron />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="mt-5 flex flex-col divide-y divide-[var(--border)]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-4">
          <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--surface-3)]" />
          <div className="flex-1 animate-pulse space-y-2">
            <div className="h-3 w-16 rounded bg-[var(--surface-2)]" />
            <div className="h-3.5 w-3/4 rounded bg-[var(--surface-3)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--surface-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-1 h-4 w-4 shrink-0 text-[var(--faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--muted)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function FlameIcon({ active }: { active: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-[var(--surface-2)] text-[var(--faint)]"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
        <path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c0-1 0-2-.5-3 2 1.5 3.5 4 3.5 7a8 8 0 11-16 0c0-3.5 2.5-6 4-8 1 1 1 2 1 3a2 2 0 004 0c0-2-1-3-1-5z" />
      </svg>
    </span>
  );
}

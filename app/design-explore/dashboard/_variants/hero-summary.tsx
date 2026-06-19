"use client";

/**
 * IDIOM: hero-summary — Oura / Whoop daily overview.
 *
 * Composition: ONE consolidated status hero leads — the activity streak + a
 * single "this week" headline read ("how am I doing?" answered in a sentence,
 * before any numbers) — with the chat bar woven INTO the hero. The six
 * per-domain metrics are demoted to a calmer secondary tier beneath, in
 * smaller, quieter type. When data is sparse the hero leans on the streak and
 * the chat invitation, so the front door is still warm on day one.
 *
 * Distinct by: a dramatic type-scale jump (one very large hero line, then a
 * demoted detail tier), generous vertical breathing room up top tightening
 * below. The hero is a STATUS, not a grid. The calmest front door.
 *
 * In-system: v0.4 tokens only — periwinkle as app-chrome (the hero ring +
 * chat), discipline hues confined to the secondary domain tier.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEEP_LINKS, type DashboardData } from "../_fixtures/data";

export function HeroSummaryVariant({ data, loading }: { data: DashboardData; loading: boolean }) {
  const status = buildStatus(data);
  return (
    <div className="px-5 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-2xl">
        {/* Hero ------------------------------------------------------------ */}
        <p className="text-sm text-[var(--muted)]">Good afternoon, {data.greetingName}.</p>

        {loading ? (
          <div className="mt-5 animate-pulse space-y-4">
            <div className="h-10 w-3/4 rounded bg-[var(--surface-3)]" />
            <div className="h-10 w-1/2 rounded bg-[var(--surface-2)]" />
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-5">
            <StreakRing weeks={data.streak.weeks} active={data.streak.activeDaysThisWeek} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.9rem] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[2.4rem]">
                {status.headline}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{status.sub}</p>
            </div>
          </div>
        )}

        {/* Chat woven into the hero ---------------------------------------- */}
        <ChatHero />

        {/* Demoted secondary tier ------------------------------------------ */}
        <div className="mt-9 border-t border-[var(--border)] pt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
            This week
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <SecondaryStat
              href={DEEP_LINKS.running}
              label="Running"
              value={data.running ? `${data.running.weekDistanceMi} mi` : null}
              sub={data.running ? `${data.running.runCount} runs` : "Log a run"}
              dot="var(--discipline-run-dot)"
              loading={loading}
            />
            <SecondaryStat
              href={DEEP_LINKS.lifting}
              label="Lifting"
              value={data.lifting ? data.lifting.weekTime : null}
              sub={data.lifting ? `${data.lifting.sessions} sessions` : "Start lifting"}
              dot="var(--discipline-lift-dot)"
              loading={loading}
            />
            <SecondaryStat
              href={DEEP_LINKS.steps}
              label="Steps"
              value={data.steps ? data.steps.avg.toLocaleString() : null}
              sub={
                data.steps?.goal
                  ? `${Math.round((data.steps.avg / data.steps.goal) * 100)}% of goal`
                  : "Set a goal"
              }
              dot="var(--faint)"
              loading={loading}
            />
            <SecondaryStat
              href={DEEP_LINKS.nutrition}
              label="Nutrition"
              value={data.nutrition ? `${data.nutrition.calories.toLocaleString()}` : null}
              sub={data.nutrition ? "kcal today" : "Log meals"}
              dot="var(--faint)"
              loading={loading}
            />
            <SecondaryStat
              href={DEEP_LINKS.bodyweight}
              label="Bodyweight"
              value={data.bodyweight ? `${data.bodyweight.current} ${data.bodyweight.unit}` : null}
              sub={
                data.bodyweight
                  ? `${data.bodyweight.ratePerWeek > 0 ? "+" : ""}${data.bodyweight.ratePerWeek}/wk`
                  : "Log weight"
              }
              dot="var(--faint)"
              loading={loading}
            />
            <SecondaryStat
              href={DEEP_LINKS.streak}
              label="Streak"
              value={data.streak.weeks > 0 ? `${data.streak.weeks} wk` : null}
              sub={
                data.streak.weeks > 0 ? `${data.streak.activeDaysThisWeek}/7 active` : "Begin today"
              }
              dot="var(--accent)"
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Synthesizes the single "how am I doing" status line from the fixture. */
function buildStatus(data: DashboardData): { headline: string; sub: string } {
  const hasAny = data.running || data.lifting || data.steps || data.nutrition || data.bodyweight;
  if (!hasAny && data.streak.weeks === 0) {
    return {
      headline: "Let’s build your first week.",
      sub: "Log a run, a lift, or your steps and your dashboard comes alive. Ask the coach below where to start.",
    };
  }
  const bits: string[] = [];
  if (data.running?.deltaPct != null)
    bits.push(
      `running ${data.running.deltaPct >= 0 ? "up" : "down"} ${Math.abs(data.running.deltaPct)}%`,
    );
  if (data.lifting?.prs) bits.push(`${data.lifting.prs} new PRs`);
  if (data.steps?.goal && data.steps.avg / data.steps.goal >= 0.9) bits.push("steps on goal");
  const sub = bits.length
    ? `You’re ${bits.join(", ")} this week — keep the momentum going.`
    : "A steady week. Keep your streak alive.";
  return {
    headline:
      data.streak.activeDaysThisWeek >= 3
        ? "You’re having a strong week."
        : "You’re moving — keep it up.",
    sub,
  };
}

function StreakRing({ weeks, active }: { weeks: number; active: number }) {
  const pct = Math.min(active / 7, 1);
  const C = 2 * Math.PI * 34;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums tracking-[-0.03em]">{weeks}</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">wk</span>
      </div>
    </div>
  );
}

function ChatHero() {
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
      className="mt-7"
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-3.5 transition focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent-line)]">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask your coach — “what should I train today?”"
          className="min-w-0 flex-1 bg-transparent text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function SecondaryStat({
  href,
  label,
  value,
  sub,
  dot,
  loading,
}: {
  href: string;
  label: string;
  value: string | null;
  sub: string;
  dot: string;
  loading: boolean;
}) {
  return (
    <a href={href} className="group block">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="mt-1.5 h-6 w-20 animate-pulse rounded bg-[var(--surface-3)]" />
      ) : value ? (
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
          {value}
        </p>
      ) : (
        <p className="mt-1 text-lg font-medium text-[var(--faint)]">—</p>
      )}
      <p className={`mt-0.5 text-xs ${value ? "text-[var(--muted)]" : "text-[var(--accent)]"}`}>
        {sub}
      </p>
    </a>
  );
}

"use client";

/**
 * IDIOM: streak-momentum — heroes CONSISTENCY.
 *
 * Draws on Whoop's consistency readout and Gentler Streak's gentle on/off-
 * target framing, leaning into the design system's first-class streak Voice
 * ("you hit your goal N of M days" — encouraging, never scolding).
 *
 *  - Type scale: compact. Hierarchy comes from the ribbon and the streak
 *    count, not one giant figure.
 *  - Color logic: success-green = a hit, muted slate = a miss, the periwinkle
 *    accent rides the CURRENT (active) streak only.
 *  - Spacing rhythm: tight, momentum-forward — a ribbon, then runs.
 *
 * In-system: near-black ramp, periwinkle accent, Manrope, 14px panels.
 */

import {
  type StepsEntry,
  type Goal,
  type Period,
  type Day,
  type Run,
  buildAxis,
  buildRuns,
  deriveStats,
  fmt,
  fmtK,
  shortDate,
} from "../_data";
import { CheckIcon, PencilIcon, TargetIcon } from "../_icons";

type Props = { entries: StepsEntry[]; goal: Goal; period: Period };

export function StreakMomentum({ entries, goal, period }: Props) {
  const hasGoal = goal.goal > 0;
  const stats = deriveStats(entries, period, goal.goal);
  const axis = buildAxis(entries, period, goal.goal);
  const runs = buildRuns(axis).slice().reverse(); // newest runs first

  if (stats.avg === null) return <EmptyStreak />;

  // No goal ⇒ no streak story; fall back to a calm "just the steps" framing.
  if (!hasGoal) return <NoGoalStreak stats={stats} axis={axis} />;

  return (
    <div className="@container flex flex-col gap-6 text-[var(--foreground)]">
      {/* ── Streak hero — the Voice ──────────────────────────────── */}
      <header className="rounded-[var(--radius-card)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-4">
        <p className="text-[13px] text-[var(--muted)]">
          {stats.currentStreak > 0 ? "You're on a roll" : "Let's start a streak"}
        </p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex items-end gap-2">
            <span className="text-[44px] font-semibold leading-[0.85] tracking-[-0.04em] tabular-nums text-[var(--accent)]">
              {stats.currentStreak}
            </span>
            <span className="pb-1.5 text-[13px] leading-tight text-[var(--muted)]">
              day{stats.currentStreak === 1 ? "" : "s"}
              <br />
              current streak
            </span>
          </div>
          <p className="pb-1 text-[14px] leading-snug text-[var(--foreground)]">
            You hit your goal{" "}
            <span className="font-semibold" style={{ color: "var(--success)" }}>
              {stats.daysHit} of {stats.daysLogged}
            </span>{" "}
            days — averaging {fmt(stats.avg!)}/day.
          </p>
        </div>
      </header>

      {/* ── KPI row reframed around consistency ─────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Hit rate" value={`${stats.hitRatePct}%`} tone="success" />
        <Kpi label="Days hit" value={`${stats.daysHit}/${stats.daysLogged}`} />
        <Kpi label="Avg / day" value={fmtK(stats.avg!)} />
      </div>

      {/* ── Hit-streak ribbon ───────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          This period
        </h3>
        <Ribbon axis={axis} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--faint)]">
          <Legend swatch="var(--success)" label="hit goal" />
          <Legend swatch="var(--accent)" label="current streak" />
          <Legend swatch="var(--surface-3)" label="under goal" />
          <Legend swatch="transparent" label="unlogged" outline />
        </div>
      </section>

      {/* ── Runs, not isolated rows ─────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
          >
            <PencilIcon className="h-4 w-4" /> Log steps
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <TargetIcon className="h-4 w-4" /> {fmt(goal.goal)}
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {runs
            .filter((r) => r.kind !== "gap" || r.days.length > 0)
            .slice(0, 6)
            .map((run, i) => (
              <RunRow
                key={i}
                run={run}
                goal={goal.goal}
                active={i === 0 && run.kind === "hit" && stats.currentStreak > 0}
              />
            ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
      <div
        className="text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
        style={{ color: tone === "success" ? "var(--success)" : "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

/** The ribbon: one segment per day, consecutive hits visually joined; the
 * trailing active streak rides the accent; misses muted; gaps outlined. */
function Ribbon({ axis }: { axis: Day[] }) {
  // Mark the trailing run of hits as "active".
  let activeFrom = axis.length;
  for (let i = axis.length - 1; i >= 0; i--) {
    if (axis[i].hit) activeFrom = i;
    else break;
  }
  return (
    <div className="flex items-end gap-[3px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
      {axis.map((d, i) => {
        const active = i >= activeFrom && d.hit;
        let bg = "var(--surface-3)";
        let border = "transparent";
        if (!d.logged) {
          bg = "transparent";
          border = "var(--border-strong)";
        } else if (active) bg = "var(--accent)";
        else if (d.hit) bg = "var(--success)";
        const h = d.hit ? 28 : d.logged ? 16 : 14;
        return (
          <div
            key={d.date}
            title={`${shortDate(d.date)}: ${d.steps === null ? "unlogged" : fmt(d.steps)}`}
            className="flex-1 rounded-[2px]"
            style={{
              height: h,
              background: bg,
              border: border === "transparent" ? undefined : `1px dashed ${border}`,
            }}
          />
        );
      })}
    </div>
  );
}

function Legend({ swatch, label, outline }: { swatch: string; label: string; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-[2px]"
        style={{
          background: swatch,
          border: outline ? "1px dashed var(--border-strong)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

function RunRow({ run, goal, active }: { run: Run; goal: number; active: boolean }) {
  const isHit = run.kind === "hit";
  const isGap = run.kind === "gap";
  const n = run.days.length;
  const span = `${shortDate(run.days[0].date)} – ${shortDate(run.days[n - 1].date)}`;
  const accent = active
    ? "var(--accent)"
    : isHit
      ? "var(--success)"
      : isGap
        ? "var(--faint)"
        : "var(--muted)";
  return (
    <li
      className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--surface)] px-3 py-2.5"
      style={{ borderColor: active ? "var(--accent-line)" : "var(--border)" }}
    >
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{
          background: isHit
            ? active
              ? "var(--accent-soft)"
              : "rgba(134,179,159,0.15)"
            : "var(--surface-3)",
          color: accent,
        }}
      >
        {isHit ? <CheckIcon className="h-4 w-4" /> : isGap ? "·" : "—"}
      </span>
      <div className="flex-1">
        <div
          className="text-[13px] font-medium"
          style={{ color: isGap ? "var(--faint)" : "var(--foreground)" }}
        >
          {isHit
            ? `${n}-day streak${active ? " · current" : ""}`
            : isGap
              ? `${n} unlogged day${n === 1 ? "" : "s"}`
              : `${n} under goal`}
        </div>
        <div className="text-[11px] text-[var(--faint)]">
          {n === 1 ? shortDate(run.days[0].date) : span}
        </div>
      </div>
      {!isGap && (
        <span className="text-[12px] tabular-nums text-[var(--muted)]">
          {isHit ? "≥" : "<"} {fmtK(goal)}
        </span>
      )}
    </li>
  );
}

function NoGoalStreak({ stats, axis }: { stats: ReturnType<typeof deriveStats>; axis: Day[] }) {
  return (
    <div className="@container flex flex-col gap-5 text-[var(--foreground)]">
      <header className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
        <p className="text-[13px] text-[var(--muted)]">Set a goal to track your streak</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {fmt(stats.avg!)}
          </span>
          <span className="pb-1.5 text-[13px] text-[var(--muted)]">avg / day</span>
        </div>
      </header>
      <div className="flex items-end gap-[3px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
        {axis.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-[2px]"
            style={{
              height: d.logged ? 24 : 12,
              background: d.logged ? "var(--accent)" : "transparent",
              border: d.logged ? undefined : "1px dashed var(--border-strong)",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
      >
        <TargetIcon className="h-4 w-4" /> Set step goal
      </button>
    </div>
  );
}

function EmptyStreak() {
  return (
    <div className="@container flex flex-col items-start gap-3 py-10">
      <p className="text-[15px] font-medium">No streak yet</p>
      <p className="max-w-[36ch] text-[13px] text-[var(--muted)]">
        Log a day at or over your goal to start one — we&apos;ll count the run for you.
      </p>
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
      >
        <PencilIcon className="h-3.5 w-3.5" /> Log steps
      </button>
    </div>
  );
}

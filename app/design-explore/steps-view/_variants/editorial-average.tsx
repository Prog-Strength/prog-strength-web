"use client";

/**
 * IDIOM: editorial-average — heroes THE AVERAGE ITSELF.
 *
 * Draws on The Athletic's authored headline-figure layout: one oversized
 * tabular number with a small set-in caption, the chart as a captioned
 * figure, the rest demoted to quiet metadata.
 *
 *  - Type scale: dramatic big/small contrast. The avg-daily-steps figure is
 *    the page's headline (huge tabular Manrope); goal / best / total are
 *    small captioned figures beneath; the log is a hairline ledger.
 *  - Color logic: near-monochrome ink-on-dark. The single periwinkle accent
 *    is RESERVED for the hero average and its baseline drawn across the
 *    figure; success-green only annotates the goal reference.
 *  - Spacing rhythm: generous, editorial — the page breathes.
 *
 * In-system: near-black ramp, periwinkle accent, Manrope, 14px panels.
 */

import {
  type StepsEntry,
  type Goal,
  type Period,
  type Day,
  buildAxis,
  deriveStats,
  entriesInPeriod,
  fmt,
  fmtK,
  PERIODS,
  rowDate,
  shortDate,
} from "../_data";
import { PencilIcon, TargetIcon } from "../_icons";

type Props = { entries: StepsEntry[]; goal: Goal; period: Period };

export function EditorialAverage({ entries, goal, period }: Props) {
  const hasGoal = goal.goal > 0;
  const stats = deriveStats(entries, period, goal.goal);
  const axis = buildAxis(entries, period, goal.goal);
  const recent = entriesInPeriod(entries, period).slice(0, 6);
  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase() ?? "";

  if (stats.avg === null) {
    return <EmptyEditorial />;
  }

  const single = stats.daysLogged === 1;

  return (
    <div className="@container flex flex-col gap-9 text-[var(--foreground)]">
      {/* ── Headline figure ─────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Average daily steps
        </span>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <span className="font-semibold leading-[0.85] tracking-[-0.04em] tabular-nums text-[var(--accent)] text-[64px] @md:text-[88px]">
            {fmt(stats.avg)}
          </span>
          <span className="pb-2 text-[13px] leading-tight text-[var(--muted)]">
            avg / day
            <br />
            <span className="text-[var(--faint)]">{periodLabel}</span>
          </span>
        </div>
        {hasGoal && stats.attainmentPct !== null && !single && (
          <p className="mt-1 max-w-[46ch] text-[15px] leading-snug text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">
              {stats.attainmentPct}% of your {fmt(goal.goal)} goal
            </span>{" "}
            — {stats.attainmentPct >= 100 ? "clear of" : "just under"} target, hit on{" "}
            <span className="text-[var(--foreground)]">
              {stats.daysHit} of {stats.daysLogged}
            </span>{" "}
            logged days.
          </p>
        )}
        {!hasGoal && (
          <p className="mt-1 text-[15px] text-[var(--muted)]">
            No goal set — <span className="text-[var(--foreground)]">just the steps</span> for now.
          </p>
        )}
      </header>

      {/* ── Demoted figures — small captioned, set in a rule ────── */}
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)]">
        <Figure label="Total" value={fmt(stats.total)} />
        <Figure
          label="Best day"
          value={stats.best ? fmt(stats.best.steps) : "—"}
          caption={stats.best ? shortDate(stats.best.date) : undefined}
        />
        <Figure
          label="Goal"
          value={hasGoal ? fmt(goal.goal) : "—"}
          caption={hasGoal ? "daily target" : "not set"}
        />
      </dl>

      {/* ── The figure: a captioned chart, average drawn as baseline ─ */}
      <figure className="flex flex-col gap-3">
        <FigureChart axis={axis} avg={stats.avg} goal={hasGoal ? goal.goal : null} />
        <figcaption className="text-[12px] leading-relaxed text-[var(--faint)]">
          Daily steps over {periodLabel}. The{" "}
          <span className="text-[var(--accent)]">solid periwinkle line</span> is your average
          {hasGoal && (
            <>
              ; the <span className="text-[var(--success)]">dashed line</span> is the{" "}
              {fmt(goal.goal)} goal it sits just under
            </>
          )}
          . Unlogged days break the trace.
        </figcaption>
      </figure>

      {/* ── Quiet ledger ────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Recent log
          </h3>
          <div className="flex items-center gap-4 text-[13px] text-[var(--muted)]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)]"
            >
              <PencilIcon className="h-3.5 w-3.5" /> Log steps
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)]"
            >
              <TargetIcon className="h-3.5 w-3.5" />
              {hasGoal ? fmt(goal.goal) : "Set goal"}
            </button>
          </div>
        </div>
        <ul className="flex flex-col">
          {recent.map((e) => {
            const over = hasGoal && e.steps >= goal.goal;
            return (
              <li
                key={e.id}
                className="flex items-baseline justify-between border-b border-[var(--border)]/60 py-2 last:border-b-0"
              >
                <span className="text-[13px] text-[var(--muted)]">{rowDate(e.date)}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[15px] font-medium tabular-nums">{fmt(e.steps)}</span>
                  {hasGoal && (
                    <span
                      className="w-12 text-right text-[11px] tabular-nums"
                      style={{ color: over ? "var(--success)" : "var(--faint)" }}
                    >
                      {over ? "on goal" : `${Math.round((e.steps / goal.goal) * 100)}%`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Figure({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="bg-[var(--background)] px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        {label}
      </dt>
      <dd className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </dd>
      {caption && <span className="mt-1 block text-[11px] text-[var(--faint)]">{caption}</span>}
    </div>
  );
}

/** Slim area trace with the average as an accent baseline and the goal as a
 * dashed success reference. Monochrome ink; accent earns only the baseline. */
function FigureChart({ axis, avg, goal }: { axis: Day[]; avg: number; goal: number | null }) {
  const W = 100;
  const H = 34;
  const maxRaw = Math.max(...axis.map((d) => d.steps ?? 0), goal ?? 0, avg);
  const maxY = maxRaw * 1.12;
  const x = (i: number) => (axis.length <= 1 ? W / 2 : (i / (axis.length - 1)) * W);
  const y = (v: number) => H - (v / maxY) * H;

  // Build line segments, breaking on gaps.
  const segments: string[] = [];
  let cur: string[] = [];
  axis.forEach((d, i) => {
    if (d.steps === null) {
      if (cur.length) segments.push(cur.join(" "));
      cur = [];
    } else {
      cur.push(`${cur.length ? "L" : "M"}${x(i).toFixed(2)},${y(d.steps).toFixed(2)}`);
    }
  });
  if (cur.length) segments.push(cur.join(" "));

  const avgY = y(avg);
  const goalY = goal !== null ? y(goal) : null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 pb-2 pt-3">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full">
        {/* goal reference */}
        {goalY !== null && (
          <line
            x1={0}
            x2={W}
            y1={goalY}
            y2={goalY}
            stroke="var(--success)"
            strokeWidth={0.4}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* the trace */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* points */}
        {axis.map((d, i) =>
          d.steps === null ? null : (
            <circle
              key={d.date}
              cx={x(i)}
              cy={y(d.steps)}
              r={0.7}
              fill={goal !== null && d.steps >= goal ? "var(--success)" : "var(--faint)"}
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
        {/* the average — the hero baseline, in accent */}
        <line
          x1={0}
          x2={W}
          y1={avgY}
          y2={avgY}
          stroke="var(--accent)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-[var(--faint)]">
        <span style={{ color: "var(--accent)" }}>avg {fmtK(avg)}</span>
        {goal !== null && <span style={{ color: "var(--success)" }}>goal {fmtK(goal)}</span>}
      </div>
    </div>
  );
}

function EmptyEditorial() {
  return (
    <div className="@container flex flex-col items-start gap-3 py-8">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Average daily steps
      </span>
      <span className="text-[64px] font-semibold leading-[0.85] tracking-[-0.04em] text-[var(--faint)]">
        —
      </span>
      <p className="max-w-[40ch] text-[15px] text-[var(--muted)]">
        Nothing logged yet. Tap <span className="text-[var(--foreground)]">Log steps</span> to add
        today and start the story.
      </p>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
      >
        <PencilIcon className="h-3.5 w-3.5" /> Log steps
      </button>
    </div>
  );
}

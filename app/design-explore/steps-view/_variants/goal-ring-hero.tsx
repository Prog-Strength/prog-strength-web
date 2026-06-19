"use client";

/**
 * IDIOM: goal-ring-hero — heroes GOAL ATTAINMENT.
 *
 * Draws on Apple Fitness's activity ring and Gentler Streak's goal-relative
 * day treatment: the abstract percent becomes a fillable arc you read in a
 * glance, the value sitting in its center.
 *
 *  - Type scale: the ring's center number is the size anchor; the chart and
 *    rows stay small around it.
 *  - Color logic: the periwinkle accent FILLS the ring's progress;
 *    success-green marks the days (and the overall) that clear the goal.
 *    Bars are drawn goal-relative — the muted base climbs to the goal line,
 *    the success crest tops anything over it.
 *  - Spacing rhythm: centered, generous around the ring.
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
  rowDate,
} from "../_data";
import { PencilIcon, TargetIcon } from "../_icons";

type Props = { entries: StepsEntry[]; goal: Goal; period: Period };

export function GoalRingHero({ entries, goal, period }: Props) {
  const hasGoal = goal.goal > 0;
  const stats = deriveStats(entries, period, goal.goal);
  const axis = buildAxis(entries, period, goal.goal);
  const recent = entriesInPeriod(entries, period).slice(0, 6);

  if (stats.avg === null) return <EmptyRing />;

  const pct = stats.attainmentPct;
  const cleared = pct !== null && pct >= 100;

  return (
    <div className="@container flex flex-col items-center gap-8 text-[var(--foreground)]">
      {/* ── The ring ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Ring pct={hasGoal ? pct : null} center={fmt(stats.avg)} cleared={cleared} />
        <p className="text-center text-[13px] text-[var(--muted)]">
          {hasGoal ? (
            <>
              avg / day —{" "}
              <span style={{ color: cleared ? "var(--success)" : "var(--accent)" }}>
                {pct}% of {fmt(goal.goal)} goal
              </span>
            </>
          ) : (
            <>avg / day — no goal set</>
          )}
        </p>
      </div>

      {/* ── Supporting stats, centered under the ring ───────────── */}
      <div className="flex w-full max-w-sm items-stretch justify-center gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] text-center">
        <MiniStat
          label="Days hit"
          value={hasGoal ? `${stats.daysHit}/${stats.daysLogged}` : "—"}
          tone={hasGoal ? "success" : "muted"}
        />
        <MiniStat label="Best" value={stats.best ? fmtK(stats.best.steps) : "—"} />
        <MiniStat label="Total" value={fmtK(stats.total)} />
      </div>

      {/* ── Goal-relative bars ──────────────────────────────────── */}
      <div className="w-full">
        <RelativeBars axis={axis} goal={hasGoal ? goal.goal : null} />
      </div>

      {/* ── Rows with per-day mini rings ────────────────────────── */}
      <section className="flex w-full flex-col gap-3">
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
            <TargetIcon className="h-4 w-4" /> {hasGoal ? fmt(goal.goal) : "Set goal"}
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {recent.map((e) => {
            const p = hasGoal ? Math.round((e.steps / goal.goal) * 100) : null;
            const hit = hasGoal && e.steps >= goal.goal;
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <MiniRing pct={p} hit={hit} />
                <span className="flex-1 text-[13px] text-[var(--muted)]">{rowDate(e.date)}</span>
                <span className="text-[15px] font-semibold tabular-nums">{fmt(e.steps)}</span>
                {p !== null && (
                  <span
                    className="w-11 text-right text-[12px] font-medium tabular-nums"
                    style={{ color: hit ? "var(--success)" : "var(--muted)" }}
                  >
                    {p}%
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** The hero ring. Accent fills progress; clears to success once at/over goal.
 * No goal ⇒ a calm neutral track with the average plainly centered. */
function Ring({ pct, center, cleared }: { pct: number | null; center: string; cleared: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  const stroke = cleared ? "var(--success)" : "var(--accent)";
  return (
    <div className="relative grid h-[148px] w-[148px] place-items-center @md:h-[180px] @md:w-[180px]">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        {pct !== null && (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums @md:text-[42px]">
          {center}
        </span>
        {pct !== null && (
          <span
            className="mt-1 text-[12px] font-semibold tabular-nums"
            style={{ color: cleared ? "var(--success)" : "var(--accent)" }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

function MiniRing({ pct, hit }: { pct: number | null; hit: boolean }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  return (
    <svg viewBox="0 0 22 22" className="h-6 w-6 -rotate-90">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
      {pct !== null && (
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke={hit ? "var(--success)" : "var(--accent)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      )}
    </svg>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "muted";
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "muted" ? "var(--faint)" : "var(--foreground)";
  return (
    <div className="flex-1 bg-[var(--background)] px-3 py-3">
      <div className="text-[16px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

/** Bars read against the goal line as the dominant reference: the muted base
 * climbs toward the line, the success crest tops days that clear it; unlogged
 * days are hairline ticks (a gap, not a zero). */
function RelativeBars({ axis, goal }: { axis: Day[]; goal: number | null }) {
  const maxRaw = Math.max(...axis.map((d) => d.steps ?? 0), goal ?? 0);
  const maxY = maxRaw * 1.1 || 1;
  const ref = goal ?? maxY;
  const goalPct = (ref / maxY) * 100;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="relative h-36">
        {/* goal line */}
        {goal !== null && (
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed"
            style={{ bottom: `${goalPct}%`, borderColor: "var(--success)" }}
          >
            <span
              className="absolute -top-4 right-0 text-[10px] tabular-nums"
              style={{ color: "var(--success)" }}
            >
              goal {fmtK(goal)}
            </span>
          </div>
        )}
        <div className="flex h-full items-end gap-[2px]">
          {axis.map((d) => {
            if (d.steps === null) {
              return (
                <div
                  key={d.date}
                  className="flex-1 self-end"
                  style={{ height: 2, background: "var(--border-strong)" }}
                />
              );
            }
            const h = (d.steps / maxY) * 100;
            const baseH = goal !== null ? (Math.min(d.steps, goal) / maxY) * 100 : h;
            const crestH = goal !== null && d.steps > goal ? ((d.steps - goal) / maxY) * 100 : 0;
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col justify-end"
                style={{ height: "100%" }}
              >
                {crestH > 0 && (
                  <div
                    style={{
                      height: `${crestH}%`,
                      background: "var(--success)",
                      borderRadius: "1px 1px 0 0",
                    }}
                  />
                )}
                <div
                  style={{
                    height: `${baseH}%`,
                    background: goal === null ? "var(--accent)" : "var(--surface-3)",
                    borderRadius: crestH > 0 ? 0 : "1px 1px 0 0",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--faint)]">
        {goal !== null
          ? "Muted base climbs to the goal line; the green crest tops days over it."
          : "No goal set — bars show daily steps in the accent."}
      </p>
    </div>
  );
}

function EmptyRing() {
  return (
    <div className="@container flex flex-col items-center gap-4 py-10 text-center">
      <div className="grid h-[148px] w-[148px] place-items-center">
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <circle cx="64" cy="64" r="52" fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        </svg>
      </div>
      <p className="max-w-[34ch] text-[14px] text-[var(--muted)]">
        No steps yet — your ring fills as you log days against your goal.
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
      >
        <PencilIcon className="h-3.5 w-3.5" /> Log steps
      </button>
    </div>
  );
}

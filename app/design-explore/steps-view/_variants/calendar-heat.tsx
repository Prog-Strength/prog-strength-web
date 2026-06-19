"use client";

/**
 * IDIOM: calendar-heat — heroes a CALENDAR GRID.
 *
 * Draws on the GitHub contribution graph and Cardiogram's day calendar: the
 * bar chart becomes a month heatmap, each day a cell shaded by goal
 * attainment, so streaks and gaps read SPATIALLY. The Date·Steps table
 * becomes the detail view beneath — tap a cell to pull up its row.
 *
 *  - Type scale: uniform grid labels, one calm header figure — no giant number.
 *  - Color logic: a single-hue attainment ramp (success, intensity = % of
 *    goal); days that clear goal get a thin accent ring as the "win"; unlogged
 *    days are hairline-outline cells (a gap, never a 0).
 *  - Spacing rhythm: even, gridded, calendar-regular.
 *
 * In-system: near-black ramp, periwinkle accent, Manrope, 14px panels.
 */

import { useMemo, useState } from "react";
import {
  type StepsEntry,
  type Goal,
  type Period,
  type Day,
  buildAxis,
  buildWeeks,
  deriveStats,
  entriesInPeriod,
  fmt,
  rowDate,
} from "../_data";
import { PencilIcon, TargetIcon, TrashIcon } from "../_icons";

type Props = { entries: StepsEntry[]; goal: Goal; period: Period };

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarHeat({ entries, goal, period }: Props) {
  const hasGoal = goal.goal > 0;
  const stats = deriveStats(entries, period, goal.goal);
  const axis = buildAxis(entries, period, goal.goal);
  const weeks = useMemo(() => buildWeeks(axis), [axis]);
  const maxSteps = Math.max(...axis.map((d) => d.steps ?? 0), goal.goal || 1);

  // Selected cell defaults to the most recent logged day.
  const lastLogged = [...axis].reverse().find((d) => d.logged) ?? null;
  const [selected, setSelected] = useState<string | null>(lastLogged?.date ?? null);

  if (stats.avg === null) return <EmptyHeat />;

  const selectedDay = axis.find((d) => d.date === selected) ?? lastLogged;

  return (
    <div className="@container flex flex-col gap-5 text-[var(--foreground)]">
      {/* ── Calm header ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <div>
            <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {fmt(stats.avg)}
            </span>
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">avg/day</span>
          </div>
          {hasGoal && (
            <span className="text-[12px] tabular-nums text-[var(--muted)]">
              <span style={{ color: "var(--success)" }}>{stats.daysHit}</span> of {stats.daysLogged}{" "}
              days hit · {stats.attainmentPct}% of {fmt(goal.goal)}
            </span>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <TargetIcon className="h-4 w-4" /> {hasGoal ? fmt(goal.goal) : "Set goal"}
        </button>
      </header>

      {/* ── The heatmap ─────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex gap-2">
          {/* weekday gutter */}
          <div className="flex flex-col gap-[3px] pt-[2px]">
            {WEEKDAY_LABELS.map((l, i) => (
              <span
                key={i}
                className="flex h-[var(--cell)] items-center text-[9px] text-[var(--faint)] [--cell:18px] @md:[--cell:22px]"
              >
                {l}
              </span>
            ))}
          </div>
          {/* week columns */}
          <div className="flex min-w-0 flex-1 gap-[3px] overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.cells.map((cell, ci) =>
                  cell === null ? (
                    <span
                      key={ci}
                      className="h-[var(--cell)] w-[var(--cell)] [--cell:18px] @md:[--cell:22px]"
                    />
                  ) : (
                    <HeatCell
                      key={cell.date}
                      day={cell}
                      goal={hasGoal ? goal.goal : null}
                      maxSteps={maxSteps}
                      selected={cell.date === selected}
                      onSelect={() => setSelected(cell.date)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        {/* legend */}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--faint)]">
          <span>less</span>
          {[0.18, 0.4, 0.65, 0.9].map((a, i) => (
            <span
              key={i}
              className="inline-block h-3 w-3 rounded-[3px]"
              style={{
                background: `color-mix(in srgb, var(--success) ${a * 100}%, var(--surface-3))`,
              }}
            />
          ))}
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{
              background: "var(--success)",
              outline: "1.5px solid var(--accent)",
              outlineOffset: "-1.5px",
            }}
          />
          <span>more · hit</span>
        </div>
      </div>

      {/* ── Detail view (the de-gridded table, one day at a time) ─ */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
            {selectedDay && selectedDay.logged ? "Selected day" : "Pick a day"}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
          >
            <PencilIcon className="h-4 w-4" /> Log steps
          </button>
        </div>
        <DetailCard day={selectedDay} goal={hasGoal ? goal.goal : null} />
        <RecentList
          entries={entriesInPeriod(entries, period).slice(0, 4)}
          goal={hasGoal ? goal.goal : null}
          selected={selected}
          onSelect={setSelected}
        />
      </section>
    </div>
  );
}

function HeatCell({
  day,
  goal,
  maxSteps,
  selected,
  onSelect,
}: {
  day: Day;
  goal: number | null;
  maxSteps: number;
  selected: boolean;
  onSelect: () => void;
}) {
  let style: React.CSSProperties;
  if (!day.logged) {
    // gap — hairline outline, never a filled zero
    style = { background: "transparent", border: "1px dashed var(--border-strong)" };
  } else {
    const intensity =
      goal !== null ? Math.min((day.steps ?? 0) / goal, 1) : (day.steps ?? 0) / maxSteps;
    const a = 0.15 + intensity * 0.8;
    style = {
      background: `color-mix(in srgb, var(--success) ${Math.round(a * 100)}%, var(--surface-3))`,
    };
    if (day.hit) {
      style.outline = "1.5px solid var(--accent)";
      style.outlineOffset = "-1.5px";
    }
  }
  if (selected) {
    style.outline = "2px solid var(--accent)";
    style.outlineOffset = "1px";
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${day.weekday} ${day.label}: ${day.steps === null ? "unlogged" : fmt(day.steps)}`}
      aria-label={`${day.label}: ${day.steps === null ? "unlogged" : `${fmt(day.steps)} steps`}`}
      className="h-[var(--cell)] w-[var(--cell)] rounded-[3px] transition [--cell:18px] hover:brightness-110 @md:[--cell:22px]"
      style={style}
    />
  );
}

function DetailCard({ day, goal }: { day: Day | null; goal: number | null }) {
  if (!day || !day.logged) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-5 text-center text-[13px] text-[var(--muted)]">
        {day ? `No steps logged on ${day.label}.` : "Select a cell to see its day."}
      </div>
    );
  }
  const pct = goal !== null ? Math.round((day.steps! / goal) * 100) : null;
  const hit = goal !== null && day.steps! >= goal;
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] text-[var(--muted)]">{rowDate(day.date)}</span>
        <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {fmt(day.steps!)}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {pct !== null && (
          <span
            className="rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums"
            style={{
              background: hit ? "rgba(134,179,159,0.15)" : "var(--surface-3)",
              color: hit ? "var(--success)" : "var(--muted)",
            }}
          >
            {pct}% {hit ? "· hit" : ""}
          </span>
        )}
        <div className="flex items-center gap-1 text-[var(--muted)]">
          <button
            type="button"
            aria-label="Edit"
            className="rounded p-1 hover:bg-white/5 hover:text-[var(--foreground)]"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className="rounded p-1 text-[var(--danger)] hover:bg-white/5"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentList({
  entries,
  goal,
  selected,
  onSelect,
}: {
  entries: StepsEntry[];
  goal: number | null;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-[var(--border)]/60 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      {entries.map((e) => {
        const hit = goal !== null && e.steps >= goal;
        const active = e.date === selected;
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.date)}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition hover:bg-white/[0.02]"
              style={active ? { background: "var(--accent-soft)" } : undefined}
            >
              <span className="text-[13px] text-[var(--muted)]">{rowDate(e.date)}</span>
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-medium tabular-nums">{fmt(e.steps)}</span>
                {hit && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--success)" }}
                  />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyHeat() {
  return (
    <div className="@container flex flex-col items-start gap-3 py-10">
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 21 }).map((_, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-[3px] border border-dashed border-[var(--border-strong)]"
          />
        ))}
      </div>
      <p className="max-w-[36ch] text-[13px] text-[var(--muted)]">
        No steps yet — each day you log fills in a cell, and the grid grows into your habit.
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

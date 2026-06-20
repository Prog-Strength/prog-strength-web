"use client";

/**
 * IDIOM: compact-dashboard-rail
 * ---------------------------------------------------------------------------
 * Maximum density, figure-first. A 4-column hairline tile grid where every
 * headline lift / distance is one tight stat — name + a readiness dot whose
 * intensity scales with the est-vs-PR gap, the PR figure, a one-line est
 * delta, and a micro progress-line drawn against a faint dashed PR/best
 * reference. Beneath the grid a *docked featured estimation rail* fills the
 * dead space; clicking any tile swaps that record into the rail, which opens
 * on the most-"due" record.
 *
 * Distinct on: tightest type scale (10–13px), hairline grid rules, near-zero
 * padding, a single horizontal docked rail. Leans on Linear's compact
 * tabular density and Whoop's single-accent-on-charcoal stat composition.
 *
 * in-system: lift → --discipline-lift-dot, run → --discipline-run-dot,
 * "due" cue → --warning, positive delta → --success, periwinkle --accent is
 * selection chrome only (the active tab + the selected tile ring).
 */

import { useState } from "react";
import {
  LIFTS,
  RUNNING,
  MAX_EFFORT_5K,
  deriveLift,
  liftsByReadiness,
  formatWeight,
  formatDuration,
  formatPace,
  formatSignedDuration,
  scaleSeries,
  scaleY,
  type LiftRecord,
  type RunningBestEffort,
} from "../_data/fixtures";

type Tab = "lifts" | "running";

const LIFT = "var(--discipline-lift-dot)";
const RUN = "var(--discipline-run-dot)";

export function CompactDashboardRail() {
  const [tab, setTab] = useState<Tab>("lifts");
  // Open on the most-due lift; on the fastest filled distance for running.
  const mostDue = liftsByReadiness(LIFTS).find((r) => deriveLift(r).due) ?? LIFTS[0];
  const [liftSel, setLiftSel] = useState<string>(mostDue.exercise_name);
  const [runSel, setRunSel] = useState<string>("5k");

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <RailHeader tab={tab} onTab={setTab} />
      {tab === "lifts" ? (
        <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-3 lg:grid-cols-4">
          {LIFTS.map((r) => (
            <LiftTile
              key={r.exercise_name}
              record={r}
              selected={liftSel === r.exercise_name}
              onSelect={() => setLiftSel(r.exercise_name)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-3 lg:grid-cols-4">
          {RUNNING.map((r) => (
            <RunTile
              key={r.distance_key}
              record={r}
              selected={runSel === r.distance_key}
              onSelect={() => r.duration_seconds !== null && setRunSel(r.distance_key)}
            />
          ))}
        </div>
      )}
      {tab === "lifts" ? (
        <LiftRail record={LIFTS.find((r) => r.exercise_name === liftSel) ?? mostDue} />
      ) : (
        <RunRail distanceKey={runSel} />
      )}
    </div>
  );
}

function RailHeader({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const summary =
    tab === "lifts"
      ? `${LIFTS.filter((r) => deriveLift(r).due).length} due · ${LIFTS.filter((r) => deriveLift(r).hasPR).length}/${LIFTS.length} tested`
      : `${RUNNING.filter((r) => r.duration_seconds !== null).length}/${RUNNING.length} distances`;
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
      <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-0.5 text-[11px]">
        {(["lifts", "running"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`rounded-full px-2.5 py-0.5 font-medium capitalize transition ${
              tab === t
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">{summary}</span>
    </div>
  );
}

// ── Lift tile + rail ────────────────────────────────────────────────────
function LiftTile({
  record,
  selected,
  onSelect,
}: {
  record: LiftRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const d = deriveLift(record);
  if (!d.hasPR) {
    return (
      <div className="flex flex-col gap-1 bg-[var(--surface)] p-2.5">
        <span className="truncate text-[11px] font-medium text-[var(--muted)]">
          {record.exercise_name}
        </span>
        <span className="text-lg font-semibold tabular-nums text-[var(--faint)]">—</span>
        <span className="text-[10px] text-[var(--faint)]">untested</span>
      </div>
    );
  }
  const gapPct = d.gapPct ?? 0;
  const dotOpacity = d.due ? Math.max(0.4, Math.min(gapPct, 24) / 24) : 1;
  const dotColor = d.due ? "var(--warning)" : LIFT;
  return (
    <button
      onClick={onSelect}
      title={record.exercise_name}
      className={`flex flex-col gap-1 bg-[var(--surface)] p-2.5 text-left transition hover:bg-[var(--surface-2)] ${
        selected ? "outline outline-1 -outline-offset-1 outline-[var(--accent-line)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium">{record.exercise_name}</span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor, opacity: dotOpacity }}
        />
      </div>
      <span className="text-lg font-semibold tabular-nums tracking-[-0.03em]">
        {formatWeight(record.weight, record.unit)}
        <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">
          {d.isDumbbell ? "ea" : ""}×{record.reps}
        </span>
      </span>
      <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
        {d.due && d.gap !== null ? (
          <span className="text-[var(--success)]">+{Math.round(d.gap)} est</span>
        ) : (
          <span className="text-[var(--faint)]">on est</span>
        )}
        <MicroLine points={record.recent_estimated_1rm_points} pr={record.weight} />
      </div>
    </button>
  );
}

/** Micro progress-line: the est-1RM spark drawn against a faint dashed PR line. */
function MicroLine({ points, pr }: { points: number[] | null; pr: number | null }) {
  if (!points || points.length < 2 || pr === null) return <span className="h-3 w-12" />;
  const w = 48;
  const h = 14;
  const min = Math.min(...points, pr);
  const max = Math.max(...points, pr);
  const pts = scaleSeries(points, w, h, 1, { min, max });
  const prY = scaleY(pr, min, max, h, 1);
  const above = points[points.length - 1] >= pr;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line
        x1={0}
        y1={prY}
        x2={w}
        y2={prY}
        stroke="var(--faint)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <polyline
        points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={above ? "var(--warning)" : LIFT}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LiftRail({ record }: { record: LiftRecord }) {
  const d = deriveLift(record);
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Estimated 1RM · progress toward a new max
          </p>
          <p className="truncate text-sm font-medium">{record.exercise_name}</p>
        </div>
        {d.hasPR && d.due && d.gap !== null ? (
          <p className="shrink-0 text-right text-[11px] tabular-nums text-[var(--warning)]">
            <span className="text-base font-semibold">
              +{Math.round(d.gap)} {record.unit}
            </span>
            <br />
            over logged PR — go for a max
          </p>
        ) : (
          <p className="shrink-0 text-right text-[11px] tabular-nums text-[var(--muted)]">
            est {record.current_estimated_1rm ?? "—"} {record.unit}
          </p>
        )}
      </div>
      <RailChart
        points={record.recent_estimated_1rm_points}
        pr={record.weight}
        unit={record.unit}
      />
    </div>
  );
}

/** Wide, short docked rail chart: est-1RM trend vs the dashed logged-PR line. */
function RailChart({
  points,
  pr,
  unit,
}: {
  points: number[] | null;
  pr: number | null;
  unit: string | null;
}) {
  if (!points || points.length < 2 || pr === null) {
    return (
      <div className="mt-2 flex h-16 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[11px] text-[var(--faint)]">
        Not enough data yet — log a heavy set to start the estimate.
      </div>
    );
  }
  const w = 720;
  const h = 64;
  const min = Math.min(...points, pr) - 4;
  const max = Math.max(...points, pr) + 4;
  const pts = scaleSeries(points, w, h, 6, { min, max });
  const prY = scaleY(pr, min, max, h, 6);
  const last = pts[pts.length - 1];
  const area = `${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${w},${h} 0,${h}`;
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
        <polygon points={area} fill="var(--discipline-lift-bg)" opacity={0.5} />
        <line
          x1={0}
          y1={prY}
          x2={w}
          y2={prY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={LIFT}
          strokeWidth={2}
        />
        <circle cx={last.x} cy={last.y} r={3.5} fill="var(--warning)" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--faint)]">
        <span>
          — — logged PR {pr} {unit}
        </span>
        <span>
          now {points[points.length - 1]} {unit}
        </span>
      </div>
    </div>
  );
}

// ── Run tile + rail ───────────────────────────────────────────────────────
function RunTile({
  record,
  selected,
  onSelect,
}: {
  record: RunningBestEffort;
  selected: boolean;
  onSelect: () => void;
}) {
  if (record.duration_seconds === null) {
    return (
      <div className="flex flex-col gap-1 bg-[var(--surface)] p-2.5">
        <span className="truncate text-[11px] font-medium text-[var(--muted)]">
          {record.distance_label}
        </span>
        <span className="text-lg font-semibold tabular-nums text-[var(--faint)]">—</span>
        <span className="text-[10px] text-[var(--faint)]">not covered</span>
      </div>
    );
  }
  return (
    <button
      onClick={onSelect}
      title={record.distance_label}
      className={`flex flex-col gap-1 bg-[var(--surface)] p-2.5 text-left transition hover:bg-[var(--surface-2)] ${
        selected ? "outline outline-1 -outline-offset-1 outline-[var(--accent-line)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-medium">{record.distance_label}</span>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: RUN }} />
      </div>
      <span className="text-lg font-semibold tabular-nums tracking-[-0.03em]">
        {formatDuration(record.duration_seconds)}
      </span>
      <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums text-[var(--faint)]">
        <span>{formatPace(record.pace_sec_per_km)}</span>
        <span>{record.distance_key === "5k" ? "est ↓" : ""}</span>
      </div>
    </button>
  );
}

function RunRail({ distanceKey }: { distanceKey: string }) {
  const rec = RUNNING.find((r) => r.distance_key === distanceKey);
  // Only 5K carries a max-effort estimate; everything else shows the empty
  // estimate state, mirroring the lift "not enough data yet" rail.
  if (distanceKey !== "5k" || !rec) {
    return (
      <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Max-effort estimate · {rec?.distance_label ?? distanceKey}
        </p>
        <div className="mt-2 flex h-16 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[11px] text-[var(--faint)]">
          Not enough efforts at this distance yet to project a max.
        </div>
      </div>
    );
  }
  const e = MAX_EFFORT_5K;
  const gap = e.actual_best_seconds - e.seconds; // positive ⇒ projection faster than logged best
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Max-effort estimate · 5K · progress toward a new best
          </p>
          <p className="text-sm font-medium">Projected {formatDuration(e.seconds)}</p>
        </div>
        <p className="shrink-0 text-right text-[11px] tabular-nums text-[var(--warning)]">
          <span className="text-base font-semibold">{formatSignedDuration(-gap)}</span>
          <br />
          under your logged best — a PR is in reach
        </p>
      </div>
      <RunRailChart />
    </div>
  );
}

/** Estimate-over-time descending toward the dashed logged-best line. */
function RunRailChart() {
  const e = MAX_EFFORT_5K;
  const w = 720;
  const h = 64;
  const lows = e.estimate_history.map((p) => p.lower_seconds);
  const highs = e.estimate_history.map((p) => p.upper_seconds);
  const min = Math.min(...lows, e.actual_best_seconds) - 8;
  const max = Math.max(...highs) + 8;
  const mid = scaleSeries(
    e.estimate_history.map((p) => p.seconds),
    w,
    h,
    6,
    { min, max },
  );
  const up = scaleSeries(highs, w, h, 6, { min, max });
  const lo = scaleSeries(lows, w, h, 6, { min, max });
  const bestY = scaleY(e.actual_best_seconds, min, max, h, 6);
  const band = `${up.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${lo
    .slice()
    .reverse()
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")}`;
  const last = mid[mid.length - 1];
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
        <polygon points={band} fill="var(--discipline-run-bg)" opacity={0.7} />
        <line
          x1={0}
          y1={bestY}
          x2={w}
          y2={bestY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <polyline
          points={mid.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={RUN}
          strokeWidth={2}
        />
        <circle cx={last.x} cy={last.y} r={3.5} fill="var(--warning)" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--faint)]">
        <span>— — logged best {formatDuration(e.actual_best_seconds)}</span>
        <span>{humanizeBand(e)}</span>
      </div>
    </div>
  );
}

function humanizeBand(e: typeof MAX_EFFORT_5K): string {
  return `proj ${formatDuration(e.seconds)} · band ${formatDuration(e.lower_seconds)}–${formatDuration(
    e.upper_seconds,
  )}`;
}

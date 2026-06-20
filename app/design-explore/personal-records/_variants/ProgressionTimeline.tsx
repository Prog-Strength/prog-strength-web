"use client";

/**
 * IDIOM: progression-timeline
 * ---------------------------------------------------------------------------
 * Trend-first, not figure-first. Each record is a FULL-WIDTH horizontal row
 * dominated by its over-time progression line — est-1RM climbing toward/over
 * the dashed PR line, best-effort time descending — with the current figure a
 * right-aligned endpoint label. A rail of trends you scan top to bottom, like
 * a sparkline table. The featured area is a full-width expanded timeline of
 * the selected row, the chart IS the card.
 *
 * Distinct on: horizontal rhythm, one tall row per record, the line spanning
 * the full width and the number subordinate to the slope. Leans on Garmin
 * Connect's progression charts and GitHub's contribution-rail scanning.
 *
 * in-system: lift → --discipline-lift-dot, run → --discipline-run-dot, PR/best
 * reference is a faint dashed line, the "over PR / under best" endpoint →
 * --warning; periwinkle --accent is the active tab + selected-row chrome only.
 */

import { useState } from "react";
import {
  LIFTS,
  RUNNING,
  MAX_EFFORT_5K,
  deriveLift,
  formatDate,
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

export function ProgressionTimeline() {
  const [tab, setTab] = useState<Tab>("lifts");
  const [selLift, setSelLift] = useState<string>(LIFTS[1].exercise_name); // squat: a clear climb
  const [selRun, setSelRun] = useState<string>("5k");

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Progression</h3>
        <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-0.5 text-xs">
          {(["lifts", "running"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition ${
                tab === t
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "lifts" ? (
        <>
          <div>
            {LIFTS.map((r) => (
              <LiftRow
                key={r.exercise_name}
                record={r}
                selected={selLift === r.exercise_name}
                onSelect={() => deriveLift(r).hasPR && setSelLift(r.exercise_name)}
              />
            ))}
          </div>
          <FeaturedLift record={LIFTS.find((r) => r.exercise_name === selLift) ?? LIFTS[1]} />
        </>
      ) : (
        <>
          <div>
            {RUNNING.map((r) => (
              <RunRow
                key={r.distance_key}
                record={r}
                selected={selRun === r.distance_key}
                onSelect={() => r.duration_seconds !== null && setSelRun(r.distance_key)}
              />
            ))}
          </div>
          <FeaturedRun distanceKey={selRun} />
        </>
      )}
    </div>
  );
}

// ── Rows: name | wide progression line | endpoint figure ───────────────────
function LiftRow({
  record,
  selected,
  onSelect,
}: {
  record: LiftRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const d = deriveLift(record);
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-4 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--surface-2)] ${
        selected ? "bg-[var(--accent-soft)]" : ""
      }`}
    >
      <div className="w-40 shrink-0">
        <p className="truncate text-[13px] font-medium">{record.exercise_name}</p>
        <p className="text-[10px] text-[var(--faint)]">
          {d.hasPR ? formatDate(record.achieved_at) : "untested"}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <RowLine points={record.recent_estimated_1rm_points} reference={record.weight} mode="up" />
      </div>
      <div className="w-24 shrink-0 text-right">
        {d.hasPR ? (
          <>
            <p className="text-[15px] font-semibold tabular-nums tracking-[-0.03em]">
              {record.current_estimated_1rm}
              <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
                {record.unit}
              </span>
            </p>
            {d.due && d.gap !== null ? (
              <p className="text-[10px] tabular-nums text-[var(--warning)]">
                +{Math.round(d.gap)} over PR
              </p>
            ) : (
              <p className="text-[10px] text-[var(--faint)]">on est</p>
            )}
          </>
        ) : (
          <p className="text-[15px] font-semibold text-[var(--faint)]">—</p>
        )}
      </div>
    </button>
  );
}

function RunRow({
  record,
  selected,
  onSelect,
}: {
  record: RunningBestEffort;
  selected: boolean;
  onSelect: () => void;
}) {
  const filled = record.duration_seconds !== null;
  // Only 5K has a max-effort series; other filled distances show a flat
  // single-best marker, empties a dashed placeholder line.
  const series =
    record.distance_key === "5k" ? MAX_EFFORT_5K.estimate_history.map((p) => p.seconds) : null;
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-4 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--surface-2)] ${
        selected ? "bg-[var(--accent-soft)]" : ""
      } ${filled ? "" : "opacity-60"}`}
    >
      <div className="w-40 shrink-0">
        <p className="truncate text-[13px] font-medium">{record.distance_label}</p>
        <p className="text-[10px] text-[var(--faint)]">
          {filled ? formatDate(record.activity_start_time) : "not covered"}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        {series ? (
          <RowLine points={series} reference={MAX_EFFORT_5K.actual_best_seconds} mode="down" />
        ) : (
          <div className="h-7 w-full border-b border-dashed border-[var(--border)]" />
        )}
      </div>
      <div className="w-24 shrink-0 text-right">
        {filled ? (
          <>
            <p className="text-[15px] font-semibold tabular-nums tracking-[-0.03em]">
              {formatDuration(record.duration_seconds)}
            </p>
            <p className="text-[10px] text-[var(--faint)]">{formatPace(record.pace_sec_per_km)}</p>
          </>
        ) : (
          <p className="text-[15px] font-semibold text-[var(--faint)]">—</p>
        )}
      </div>
    </button>
  );
}

/** The defining element — a wide, short progression line vs a dashed
 * reference, endpoint dotted. `mode` flips the "good" direction colour. */
function RowLine({
  points,
  reference,
  mode,
}: {
  points: number[] | null;
  reference: number | null;
  mode: "up" | "down";
}) {
  if (!points || points.length < 2 || reference === null) {
    return <div className="h-7 w-full border-b border-dashed border-[var(--border)]" />;
  }
  const w = 520;
  const h = 28;
  const min = Math.min(...points, reference) - 3;
  const max = Math.max(...points, reference) + 3;
  const pts = scaleSeries(points, w, h, 3, { min, max });
  const refY = scaleY(reference, min, max, h, 3);
  const last = pts[pts.length - 1];
  const lastVal = points[points.length - 1];
  const crossed = mode === "up" ? lastVal >= reference : lastVal <= reference;
  const endColor = crossed ? "var(--warning)" : mode === "up" ? LIFT : RUN;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <line
        x1={0}
        y1={refY}
        x2={w}
        y2={refY}
        stroke="var(--faint)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <polyline
        points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={mode === "up" ? LIFT : RUN}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3} fill={endColor} />
    </svg>
  );
}

// ── Featured: full-width expanded timeline of the selected row ───────────────
function FeaturedLift({ record }: { record: LiftRecord }) {
  const d = deriveLift(record);
  const points = record.recent_estimated_1rm_points;
  const pr = record.weight;
  return (
    <div className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Estimated-1RM timeline
          </p>
          <p className="text-base font-medium">{record.exercise_name}</p>
        </div>
        {d.hasPR && d.due && d.gap !== null && (
          <p className="text-right text-xs tabular-nums text-[var(--warning)]">
            est sits +{Math.round(d.gap)} {record.unit} over your logged PR — due for a max
          </p>
        )}
      </div>
      {points && pr !== null ? (
        <BigTimeline points={points} reference={pr} mode="up" unit={record.unit ?? ""} />
      ) : (
        <EmptyTimeline label="Log a heavy set to begin this estimate." />
      )}
    </div>
  );
}

function FeaturedRun({ distanceKey }: { distanceKey: string }) {
  const rec = RUNNING.find((r) => r.distance_key === distanceKey);
  if (distanceKey !== "5k") {
    return (
      <div className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Max-effort timeline · {rec?.distance_label ?? distanceKey}
        </p>
        <div className="mt-3">
          <EmptyTimeline label="Not enough efforts at this distance yet to project a max." />
        </div>
      </div>
    );
  }
  const e = MAX_EFFORT_5K;
  const gap = e.actual_best_seconds - e.seconds;
  return (
    <div className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Max-effort timeline
          </p>
          <p className="text-base font-medium">5K projection</p>
        </div>
        <p className="text-right text-xs tabular-nums text-[var(--warning)]">
          projection {formatSignedDuration(-gap)} under your logged best — a PR is in reach
        </p>
      </div>
      <BigTimeline
        points={e.estimate_history.map((p) => p.seconds)}
        reference={e.actual_best_seconds}
        mode="down"
        unit=""
        band={{
          lower: e.estimate_history.map((p) => p.lower_seconds),
          upper: e.estimate_history.map((p) => p.upper_seconds),
        }}
        formatVal={formatDuration}
      />
    </div>
  );
}

function BigTimeline({
  points,
  reference,
  mode,
  unit,
  band,
  formatVal,
}: {
  points: number[];
  reference: number;
  mode: "up" | "down";
  unit: string;
  band?: { lower: number[]; upper: number[] };
  formatVal?: (n: number) => string;
}) {
  const w = 760;
  const h = 150;
  const all = [...points, reference, ...(band ? [...band.lower, ...band.upper] : [])];
  const min = Math.min(...all) - 6;
  const max = Math.max(...all) + 6;
  const pts = scaleSeries(points, w, h, 14, { min, max });
  const refY = scaleY(reference, min, max, h, 14);
  const last = pts[pts.length - 1];
  const color = mode === "up" ? LIFT : RUN;
  const fmt = formatVal ?? ((n: number) => String(n));
  let bandPoly = "";
  if (band) {
    const up = scaleSeries(band.upper, w, h, 14, { min, max });
    const lo = scaleSeries(band.lower, w, h, 14, { min, max });
    bandPoly = `${up.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${lo
      .slice()
      .reverse()
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ")}`;
  }
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--background)] p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {bandPoly && <polygon points={bandPoly} fill="var(--discipline-run-bg)" opacity={0.7} />}
        <line
          x1={0}
          y1={refY}
          x2={w}
          y2={refY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="6 5"
        />
        <text x={6} y={refY - 6} className="fill-[var(--faint)]" style={{ fontSize: 11 }}>
          {mode === "up" ? "logged PR" : "logged best"} {fmt(reference)} {unit}
        </text>
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
        <circle cx={last.x} cy={last.y} r={5} fill="var(--warning)" />
        <text
          x={last.x - 8}
          y={last.y - 12}
          textAnchor="end"
          className="fill-[var(--foreground)]"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {fmt(points[points.length - 1])} {unit}
        </text>
      </svg>
    </div>
  );
}

function EmptyTimeline({ label }: { label: string }) {
  return (
    <div className="flex h-[150px] items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--background)] text-xs text-[var(--faint)]">
      {label}
    </div>
  );
}

"use client";

/**
 * IDIOM: gauge-grid
 * ---------------------------------------------------------------------------
 * Readiness expressed as GEOMETRY, not a dot. Each card centers a radial
 * gauge showing the current estimate as a fill toward — and past — the logged
 * PR mark, so "how ready am I for a new max" is read at a glance from how far
 * the arc has swept beyond the PR tick. The featured panel below is a large
 * arc gauge plus the estimate trend and (running) confidence band.
 *
 * Distinct on: centered composition, circular rhythm, figures sized INSIDE
 * the gauge, the swept-past-PR arc as the headline. Leans on Whoop's
 * recovery-ring composition and Oura's gauge-as-progress — strictly in DS
 * palette.
 *
 * in-system: arc fill lift → --discipline-lift-dot, run → --discipline-run-dot,
 * the portion swept PAST the PR/best mark → --warning, the tick is --faint;
 * periwinkle --accent is the active tab + selected-card chrome only.
 */

import { useState } from "react";
import {
  LIFTS,
  RUNNING,
  MAX_EFFORT_5K,
  deriveLift,
  liftsByReadiness,
  formatWeight,
  formatDate,
  formatDuration,
  formatPace,
  formatSignedDuration,
  humanizeConfidence,
  scaleSeries,
  scaleY,
  type LiftRecord,
  type RunningBestEffort,
} from "../_data/fixtures";

type Tab = "lifts" | "running";
const LIFT = "var(--discipline-lift-dot)";
const RUN = "var(--discipline-run-dot)";

// 270° gauge with a gap at the bottom: sweep from 135° to 405° (clockwise).
const A0 = 135;
const A1 = 405;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, fromFrac: number, toFrac: number) {
  if (toFrac <= fromFrac) return "";
  const start = A0 + (A1 - A0) * fromFrac;
  const end = A0 + (A1 - A0) * toFrac;
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function GaugeGrid() {
  const [tab, setTab] = useState<Tab>("lifts");
  const mostDue = liftsByReadiness(LIFTS).find((r) => deriveLift(r).due) ?? LIFTS[0];
  const [selLift, setSelLift] = useState(mostDue.exercise_name);
  const [selRun, setSelRun] = useState("5k");

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Readiness gauges</h3>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {LIFTS.map((r) => (
            <LiftGaugeCard
              key={r.exercise_name}
              record={r}
              selected={selLift === r.exercise_name}
              onSelect={() => deriveLift(r).hasPR && setSelLift(r.exercise_name)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {RUNNING.map((r) => (
            <RunGaugeCard
              key={r.distance_key}
              record={r}
              selected={selRun === r.distance_key}
              onSelect={() => r.duration_seconds !== null && setSelRun(r.distance_key)}
            />
          ))}
        </div>
      )}

      {tab === "lifts" ? (
        <FeaturedLiftGauge record={LIFTS.find((r) => r.exercise_name === selLift) ?? mostDue} />
      ) : (
        <FeaturedRunGauge distanceKey={selRun} />
      )}
    </div>
  );
}

/** Small card gauge. Domain centers the PR mark; fill = current estimate. */
function LiftGaugeCard({
  record,
  selected,
  onSelect,
}: {
  record: LiftRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const d = deriveLift(record);
  const size = 104;
  const c = size / 2;
  const r = 42;
  if (!d.hasPR || record.weight === null || record.current_estimated_1rm === null) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-[var(--border)] p-3">
        <EmptyGauge size={size} />
        <span className="truncate text-center text-[11px] font-medium text-[var(--muted)]">
          {record.exercise_name}
        </span>
        <span className="text-[10px] text-[var(--faint)]">untested</span>
      </div>
    );
  }
  const pr = record.weight;
  const est = record.current_estimated_1rm;
  const min = pr * 0.82;
  const max = pr * 1.18;
  const clamp = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const prFrac = clamp(pr);
  const estFrac = clamp(est);
  return (
    <button
      onClick={onSelect}
      title={record.exercise_name}
      className={`flex flex-col items-center gap-2 rounded-[14px] border p-3 transition hover:bg-[var(--surface-2)] ${
        selected ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
      }`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={arcPath(c, c, r, 0, 1)}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={arcPath(c, c, r, 0, Math.min(estFrac, prFrac))}
          fill="none"
          stroke={LIFT}
          strokeWidth={7}
          strokeLinecap="round"
        />
        {estFrac > prFrac && (
          <path
            d={arcPath(c, c, r, prFrac, estFrac)}
            fill="none"
            stroke="var(--warning)"
            strokeWidth={7}
            strokeLinecap="round"
          />
        )}
        <PrTick cx={c} cy={c} r={r} frac={prFrac} />
        <text
          x={c}
          y={c - 1}
          textAnchor="middle"
          className="fill-[var(--foreground)]"
          style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          {est}
        </text>
        <text
          x={c}
          y={c + 14}
          textAnchor="middle"
          className={d.due ? "fill-[var(--warning)]" : "fill-[var(--faint)]"}
          style={{ fontSize: 10 }}
        >
          {d.due && d.gap !== null ? `+${Math.round(d.gap)} over PR` : "on PR"}
        </text>
      </svg>
      <span className="w-full truncate text-center text-[11px] font-medium">
        {record.exercise_name}
      </span>
    </button>
  );
}

function RunGaugeCard({
  record,
  selected,
  onSelect,
}: {
  record: RunningBestEffort;
  selected: boolean;
  onSelect: () => void;
}) {
  const size = 104;
  const c = size / 2;
  const r = 42;
  if (record.duration_seconds === null) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-[var(--border)] p-3">
        <EmptyGauge size={size} />
        <span className="truncate text-center text-[11px] font-medium text-[var(--muted)]">
          {record.distance_label}
        </span>
        <span className="text-[10px] text-[var(--faint)]">not covered</span>
      </div>
    );
  }
  // 5K carries a projection: the ring fills past the "best" tick toward the
  // faster projected time. Other distances show a complete ring (best set,
  // no projection) — the same geometry, no warning sweep.
  const is5k = record.distance_key === "5k";
  let estFrac = 1;
  let bestFrac = 1;
  let due = false;
  if (is5k) {
    const e = MAX_EFFORT_5K;
    const min = e.seconds * 0.97;
    const max = e.actual_best_seconds * 1.03;
    // Faster (fewer seconds) = more swept, so invert.
    const clamp = (v: number) => Math.max(0, Math.min(1, (max - v) / (max - min)));
    bestFrac = clamp(e.actual_best_seconds);
    estFrac = clamp(e.seconds);
    due = e.seconds < e.actual_best_seconds;
  }
  return (
    <button
      onClick={onSelect}
      title={record.distance_label}
      className={`flex flex-col items-center gap-2 rounded-[14px] border p-3 transition hover:bg-[var(--surface-2)] ${
        selected ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
      }`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={arcPath(c, c, r, 0, 1)}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={arcPath(c, c, r, 0, Math.min(estFrac, bestFrac))}
          fill="none"
          stroke={RUN}
          strokeWidth={7}
          strokeLinecap="round"
        />
        {estFrac > bestFrac && (
          <path
            d={arcPath(c, c, r, bestFrac, estFrac)}
            fill="none"
            stroke="var(--warning)"
            strokeWidth={7}
            strokeLinecap="round"
          />
        )}
        {is5k && <PrTick cx={c} cy={c} r={r} frac={bestFrac} />}
        <text
          x={c}
          y={c - 1}
          textAnchor="middle"
          className="fill-[var(--foreground)]"
          style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          {formatDuration(record.duration_seconds)}
        </text>
        <text
          x={c}
          y={c + 14}
          textAnchor="middle"
          className={due ? "fill-[var(--warning)]" : "fill-[var(--faint)]"}
          style={{ fontSize: 10 }}
        >
          {is5k && due ? "PR in reach" : formatPace(record.pace_sec_per_km).replace(" /km", "")}
        </text>
      </svg>
      <span className="w-full truncate text-center text-[11px] font-medium">
        {record.distance_label}
      </span>
    </button>
  );
}

function PrTick({ cx, cy, r, frac }: { cx: number; cy: number; r: number; frac: number }) {
  const a = A0 + (A1 - A0) * frac;
  const inner = polar(cx, cy, r - 7, a);
  const outer = polar(cx, cy, r + 7, a);
  return (
    <line
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      stroke="var(--foreground)"
      strokeWidth={1.5}
    />
  );
}

function EmptyGauge({ size }: { size: number }) {
  const c = size / 2;
  const r = 42;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={arcPath(c, c, r, 0, 1)}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="2 6"
      />
      <text
        x={c}
        y={c + 6}
        textAnchor="middle"
        className="fill-[var(--faint)]"
        style={{ fontSize: 22, fontWeight: 600 }}
      >
        —
      </text>
    </svg>
  );
}

// ── Featured large gauge + trend ────────────────────────────────────────────
function FeaturedLiftGauge({ record }: { record: LiftRecord }) {
  const d = deriveLift(record);
  const points = record.recent_estimated_1rm_points;
  const pr = record.weight;
  const est = record.current_estimated_1rm;
  return (
    <div className="mt-4 grid gap-5 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-5 sm:grid-cols-[200px_1fr] sm:items-center">
      <div className="flex flex-col items-center">
        {pr !== null && est !== null ? (
          <BigGauge
            pr={pr}
            est={est}
            unit={record.unit ?? ""}
            due={d.due}
            gap={d.gap}
            mode="lift"
          />
        ) : (
          <EmptyGauge size={180} />
        )}
        <p className="mt-2 text-center text-sm font-medium">{record.exercise_name}</p>
        <p className="text-[11px] text-[var(--faint)]">
          PR {formatWeight(record.weight, record.unit)} · {formatDate(record.achieved_at)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Estimated 1RM trend
        </p>
        {points && pr !== null ? (
          <TrendStrip points={points} reference={pr} color={LIFT} formatVal={(n) => `${n}`} />
        ) : (
          <p className="mt-3 text-xs text-[var(--faint)]">Not enough data yet to chart a trend.</p>
        )}
      </div>
    </div>
  );
}

function FeaturedRunGauge({ distanceKey }: { distanceKey: string }) {
  const rec = RUNNING.find((r) => r.distance_key === distanceKey);
  if (distanceKey !== "5k" || !rec) {
    return (
      <div className="mt-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Max-effort gauge · {rec?.distance_label ?? distanceKey}
        </p>
        <p className="mt-3 text-xs text-[var(--faint)]">
          Not enough efforts at this distance yet to project a max.
        </p>
      </div>
    );
  }
  const e = MAX_EFFORT_5K;
  const gap = e.actual_best_seconds - e.seconds;
  return (
    <div className="mt-4 grid gap-5 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-5 sm:grid-cols-[200px_1fr] sm:items-center">
      <div className="flex flex-col items-center">
        <BigGauge
          pr={e.actual_best_seconds}
          est={e.seconds}
          unit=""
          due={e.seconds < e.actual_best_seconds}
          gap={gap}
          mode="run"
          formatVal={formatDuration}
        />
        <p className="mt-2 text-center text-sm font-medium">5K max effort</p>
        <p className="text-[11px] text-[var(--faint)]">
          {humanizeConfidence(e.confidence)} confidence · band {formatDuration(e.lower_seconds)}–
          {formatDuration(e.upper_seconds)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Projection trend ·{" "}
          <span className="text-[var(--warning)]">
            {formatSignedDuration(-gap)} under logged best
          </span>
        </p>
        <TrendStrip
          points={e.estimate_history.map((p) => p.seconds)}
          reference={e.actual_best_seconds}
          color={RUN}
          band={{
            lower: e.estimate_history.map((p) => p.lower_seconds),
            upper: e.estimate_history.map((p) => p.upper_seconds),
          }}
          formatVal={formatDuration}
        />
      </div>
    </div>
  );
}

function BigGauge({
  pr,
  est,
  unit,
  due,
  gap,
  mode,
  formatVal,
}: {
  pr: number;
  est: number;
  unit: string;
  due: boolean;
  gap: number | null;
  mode: "lift" | "run";
  formatVal?: (n: number) => string;
}) {
  const size = 180;
  const c = size / 2;
  const r = 72;
  const color = mode === "lift" ? LIFT : RUN;
  const fmt = formatVal ?? ((n: number) => String(n));
  let estFrac: number;
  let prFrac: number;
  if (mode === "lift") {
    const min = pr * 0.82;
    const max = pr * 1.18;
    const clamp = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
    prFrac = clamp(pr);
    estFrac = clamp(est);
  } else {
    const min = est * 0.97;
    const max = pr * 1.03;
    const clamp = (v: number) => Math.max(0, Math.min(1, (max - v) / (max - min)));
    prFrac = clamp(pr);
    estFrac = clamp(est);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={arcPath(c, c, r, 0, 1)}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <path
        d={arcPath(c, c, r, 0, Math.min(estFrac, prFrac))}
        fill="none"
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
      />
      {estFrac > prFrac && (
        <path
          d={arcPath(c, c, r, prFrac, estFrac)}
          fill="none"
          stroke="var(--warning)"
          strokeWidth={11}
          strokeLinecap="round"
        />
      )}
      <PrTick cx={c} cy={c} r={r} frac={prFrac} />
      <text
        x={c}
        y={c - 2}
        textAnchor="middle"
        className="fill-[var(--foreground)]"
        style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}
      >
        {fmt(est)}
      </text>
      <text
        x={c}
        y={c + 20}
        textAnchor="middle"
        className={due ? "fill-[var(--warning)]" : "fill-[var(--faint)]"}
        style={{ fontSize: 12 }}
      >
        {due && gap !== null
          ? mode === "lift"
            ? `+${Math.round(gap)} ${unit} over PR`
            : `${formatSignedDuration(-gap)} under best`
          : "at your best"}
      </text>
    </svg>
  );
}

/** Compact trend line for the featured side panel, vs dashed reference. */
function TrendStrip({
  points,
  reference,
  color,
  band,
  formatVal,
}: {
  points: number[];
  reference: number;
  color: string;
  band?: { lower: number[]; upper: number[] };
  formatVal: (n: number) => string;
}) {
  const w = 460;
  const h = 96;
  const all = [...points, reference, ...(band ? [...band.lower, ...band.upper] : [])];
  const min = Math.min(...all) - 5;
  const max = Math.max(...all) + 5;
  const pts = scaleSeries(points, w, h, 10, { min, max });
  const refY = scaleY(reference, min, max, h, 10);
  const last = pts[pts.length - 1];
  let bandPoly = "";
  if (band) {
    const up = scaleSeries(band.upper, w, h, 10, { min, max });
    const lo = scaleSeries(band.lower, w, h, 10, { min, max });
    bandPoly = `${up.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${lo
      .slice()
      .reverse()
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ")}`;
  }
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {bandPoly && <polygon points={bandPoly} fill="var(--discipline-run-bg)" opacity={0.7} />}
        <line
          x1={0}
          y1={refY}
          x2={w}
          y2={refY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={4} fill="var(--warning)" />
      </svg>
      <p className="mt-1 text-[10px] tabular-nums text-[var(--faint)]">
        — — reference {formatVal(reference)}
      </p>
    </div>
  );
}

"use client";

/**
 * IDIOM: split-master-detail
 * ---------------------------------------------------------------------------
 * A two-pane LEDGER. A narrow left column lists every record as a compact row
 * RANKED BY READINESS (most-due first, so "what should I attempt next" is the
 * top row); a wide right pane holds the featured estimation chart pinned in
 * view, updating as you select a row. No expand-in-place — the detail is
 * always present.
 *
 * Distinct on: a fixed two-column split with a strong vertical divider, a
 * dense scannable left ledger and a single calm focused chart on the right.
 * Leans on Linear's and Robinhood's master-detail list-plus-chart layouts.
 *
 * in-system: lift → --discipline-lift-dot, run → --discipline-run-dot, the
 * "due/over-PR" marker → --warning, gains → --success; periwinkle --accent is
 * the active tab + selected-row chrome only.
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

// Running "readiness" rank: 5K (carries a projected PR) first, then the rest
// of the covered distances, then the uncovered ones.
function runningByReadiness(records: RunningBestEffort[]): RunningBestEffort[] {
  return [...records].sort((a, b) => {
    const rank = (r: RunningBestEffort) =>
      r.distance_key === "5k" ? 0 : r.duration_seconds !== null ? 1 : 2;
    return rank(a) - rank(b);
  });
}

export function SplitMasterDetail() {
  const [tab, setTab] = useState<Tab>("lifts");
  const liftOrder = liftsByReadiness(LIFTS);
  const runOrder = runningByReadiness(RUNNING);
  const [selLift, setSelLift] = useState(liftOrder[0].exercise_name);
  const [selRun, setSelRun] = useState("5k");

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Records ledger</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Master: ranked ledger */}
        <div className="border-b border-[var(--border)] md:border-b-0 md:border-r">
          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            {tab === "lifts" ? "Most due first" : "Best efforts"}
          </p>
          <ul>
            {tab === "lifts"
              ? liftOrder.map((r) => (
                  <LiftLedgerRow
                    key={r.exercise_name}
                    record={r}
                    selected={selLift === r.exercise_name}
                    onSelect={() => deriveLift(r).hasPR && setSelLift(r.exercise_name)}
                  />
                ))
              : runOrder.map((r) => (
                  <RunLedgerRow
                    key={r.distance_key}
                    record={r}
                    selected={selRun === r.distance_key}
                    onSelect={() => r.duration_seconds !== null && setSelRun(r.distance_key)}
                  />
                ))}
          </ul>
        </div>

        {/* Detail: pinned chart */}
        <div className="min-w-0 bg-[var(--surface-2)] p-5">
          {tab === "lifts" ? (
            <LiftDetail record={LIFTS.find((r) => r.exercise_name === selLift) ?? liftOrder[0]} />
          ) : (
            <RunDetail distanceKey={selRun} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ledger rows ─────────────────────────────────────────────────────────────
function LiftLedgerRow({
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
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2 border-l-2 px-4 py-2.5 text-left transition ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-transparent hover:bg-[var(--surface-2)]"
        } ${d.hasPR ? "" : "opacity-60"}`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: !d.hasPR ? "var(--faint)" : d.due ? "var(--warning)" : LIFT }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium">{record.exercise_name}</span>
          <span className="block text-[10px] tabular-nums text-[var(--faint)]">
            {d.hasPR ? `PR ${formatWeight(record.weight, record.unit)}` : "untested"}
          </span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-[13px] font-semibold">
            {d.hasPR ? record.current_estimated_1rm : "—"}
          </span>
          {d.hasPR && d.due && d.gap !== null && (
            <span className="block text-[10px] text-[var(--warning)]">+{Math.round(d.gap)}</span>
          )}
        </span>
      </button>
    </li>
  );
}

function RunLedgerRow({
  record,
  selected,
  onSelect,
}: {
  record: RunningBestEffort;
  selected: boolean;
  onSelect: () => void;
}) {
  const filled = record.duration_seconds !== null;
  const is5k = record.distance_key === "5k";
  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2 border-l-2 px-4 py-2.5 text-left transition ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-transparent hover:bg-[var(--surface-2)]"
        } ${filled ? "" : "opacity-60"}`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: !filled ? "var(--faint)" : is5k ? "var(--warning)" : RUN }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium">{record.distance_label}</span>
          <span className="block text-[10px] tabular-nums text-[var(--faint)]">
            {filled ? formatPace(record.pace_sec_per_km) : "not covered"}
          </span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-[13px] font-semibold">
            {filled ? formatDuration(record.duration_seconds) : "—"}
          </span>
          {is5k && <span className="block text-[10px] text-[var(--warning)]">PR near</span>}
        </span>
      </button>
    </li>
  );
}

// ── Detail panes ────────────────────────────────────────────────────────────
function LiftDetail({ record }: { record: LiftRecord }) {
  const d = deriveLift(record);
  const points = record.recent_estimated_1rm_points;
  const pr = record.weight;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Estimated 1RM · progress toward a new max
          </p>
          <h4 className="mt-1 text-lg font-semibold tracking-tight">{record.exercise_name}</h4>
          <p className="text-xs text-[var(--muted)]">
            Logged PR {formatWeight(record.weight, record.unit)} ·{" "}
            {record.reps !== null ? `${record.reps} ${d.isDumbbell ? "ea " : ""}reps · ` : ""}
            {formatDate(record.achieved_at)}
          </p>
        </div>
        {d.hasPR && (
          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">
              {record.current_estimated_1rm}
              <span className="ml-1 text-sm font-normal text-[var(--muted)]">{record.unit}</span>
            </p>
            {d.due && d.gap !== null && (
              <p className="text-xs text-[var(--warning)]">
                +{Math.round(d.gap)} over PR — go for a max
              </p>
            )}
          </div>
        )}
      </div>
      <div className="mt-4">
        {points && pr !== null ? (
          <DetailChart
            points={points}
            reference={pr}
            mode="up"
            unit={record.unit ?? ""}
            formatVal={(n) => `${n}`}
          />
        ) : (
          <EmptyDetail label="Log a heavy set on this lift to start its estimate." />
        )}
      </div>
    </div>
  );
}

function RunDetail({ distanceKey }: { distanceKey: string }) {
  const rec = RUNNING.find((r) => r.distance_key === distanceKey);
  if (distanceKey !== "5k" || !rec) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Max-effort estimate · {rec?.distance_label ?? distanceKey}
        </p>
        <h4 className="mt-1 text-lg font-semibold tracking-tight">
          {rec?.distance_label ?? distanceKey}
        </h4>
        <div className="mt-4">
          <EmptyDetail label="Not enough efforts at this distance yet to project a max." />
        </div>
      </div>
    );
  }
  const e = MAX_EFFORT_5K;
  const gap = e.actual_best_seconds - e.seconds;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Max-effort estimate · progress toward a new best
          </p>
          <h4 className="mt-1 text-lg font-semibold tracking-tight">5K max effort</h4>
          <p className="text-xs text-[var(--muted)]">
            {humanizeConfidence(e.confidence)} confidence · band {formatDuration(e.lower_seconds)}–
            {formatDuration(e.upper_seconds)} · logged best {formatDuration(e.actual_best_seconds)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">
            {formatDuration(e.seconds)}
          </p>
          <p className="text-xs text-[var(--warning)]">
            {formatSignedDuration(-gap)} under best — PR in reach
          </p>
        </div>
      </div>
      <div className="mt-4">
        <DetailChart
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
        <div className="mt-3 flex gap-2">
          {e.attempts.map((a) => (
            <div
              key={a.achieved_at}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <p className="text-sm font-semibold tabular-nums">
                {formatDuration(a.duration_seconds)}
              </p>
              <p className="text-[10px] text-[var(--faint)]">{formatDate(a.achieved_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailChart({
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
  formatVal: (n: number) => string;
}) {
  const w = 560;
  const h = 180;
  const all = [...points, reference, ...(band ? [...band.lower, ...band.upper] : [])];
  const min = Math.min(...all) - 6;
  const max = Math.max(...all) + 6;
  const pts = scaleSeries(points, w, h, 16, { min, max });
  const refY = scaleY(reference, min, max, h, 16);
  const last = pts[pts.length - 1];
  const color = mode === "up" ? LIFT : RUN;
  const area = `${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${w},${h} 0,${h}`;
  let bandPoly = "";
  if (band) {
    const up = scaleSeries(band.upper, w, h, 16, { min, max });
    const lo = scaleSeries(band.lower, w, h, 16, { min, max });
    bandPoly = `${up.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${lo
      .slice()
      .reverse()
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ")}`;
  }
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--background)] p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="smd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {bandPoly ? (
          <polygon points={bandPoly} fill="var(--discipline-run-bg)" opacity={0.7} />
        ) : (
          <polygon points={area} fill="url(#smd-fill)" />
        )}
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
          {mode === "up" ? "logged PR" : "logged best"} {formatVal(reference)} {unit}
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
      </svg>
    </div>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--background)] text-xs text-[var(--faint)]">
      {label}
    </div>
  );
}

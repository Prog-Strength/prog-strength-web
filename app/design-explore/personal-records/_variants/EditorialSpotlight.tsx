"use client";

/**
 * IDIOM: editorial-spotlight
 * ---------------------------------------------------------------------------
 * Inverts the hierarchy: the featured estimation chart is a LARGE HERO at the
 * top — "Next up: Bench Press, +22 lb over your logged PR" — with the chart
 * the centerpiece and one record's progress story told at a time. The full PR
 * grid is demoted to a quieter, roomier supporting list below; tapping a row
 * promotes it into the hero.
 *
 * Distinct on: big display figures (5xl), generous vertical rhythm, lots of
 * negative space, a single hero story. Leans on Apple Fitness's summary-hero
 * composition and Strava's "you're trending toward a PR" editorial framing.
 *
 * in-system: lift → --discipline-lift-dot, run → --discipline-run-dot, the
 * "due/over PR" line → --warning, gains → --success; periwinkle --accent is
 * the active tab chrome only.
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
} from "../_data/fixtures";

type Tab = "lifts" | "running";
const LIFT = "var(--discipline-lift-dot)";
const RUN = "var(--discipline-run-dot)";

export function EditorialSpotlight() {
  const [tab, setTab] = useState<Tab>("lifts");
  const mostDue = liftsByReadiness(LIFTS).find((r) => deriveLift(r).due) ?? LIFTS[0];
  const [heroLift, setHeroLift] = useState<string>(mostDue.exercise_name);

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-6 py-7 sm:px-10 sm:py-10">
      <div className="mb-8 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Personal Records
        </p>
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
        <LiftHero record={LIFTS.find((r) => r.exercise_name === heroLift) ?? mostDue} />
      ) : (
        <RunHero />
      )}

      <div className="my-9 h-px bg-[var(--border)]" />

      {tab === "lifts" ? (
        <SupportingLifts active={heroLift} onPick={setHeroLift} />
      ) : (
        <SupportingRunning />
      )}
    </div>
  );
}

// ── Lift hero ─────────────────────────────────────────────────────────────
function LiftHero({ record }: { record: LiftRecord }) {
  const d = deriveLift(record);
  if (!d.hasPR) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          {record.exercise_name} hasn&apos;t been trained yet — log a heavy set to start its story.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warning)]">
          {d.due ? "Next up — go for a max" : "Holding strong"}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{record.exercise_name}</h3>
        <p className="mt-5 flex items-baseline gap-2">
          <span className="text-5xl font-semibold tabular-nums tracking-[-0.03em]">
            {record.current_estimated_1rm}
          </span>
          <span className="text-base text-[var(--muted)]">{record.unit} est. 1RM</span>
        </p>
        {d.due && d.gap !== null && (
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            That&apos;s{" "}
            <span className="font-semibold text-[var(--warning)]">
              +{Math.round(d.gap)} {record.unit}
            </span>{" "}
            over your logged best of {formatWeight(record.weight, record.unit)} ({record.reps}{" "}
            {d.isDumbbell ? "ea " : ""}reps) from {formatDate(record.achieved_at)}. The estimate has
            been climbing — you&apos;re likely due for a new max.
          </p>
        )}
      </div>
      <HeroLiftChart record={record} />
    </div>
  );
}

function HeroLiftChart({ record }: { record: LiftRecord }) {
  const points = record.recent_estimated_1rm_points;
  const pr = record.weight;
  if (!points || pr === null) return null;
  const w = 460;
  const h = 200;
  const min = Math.min(...points, pr) - 6;
  const max = Math.max(...points, pr) + 8;
  const pts = scaleSeries(points, w, h, 16, { min, max });
  const prY = scaleY(pr, min, max, h, 16);
  const last = pts[pts.length - 1];
  const area = `${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${w},${h} 0,${h}`;
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--background)] p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="es-lift-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--discipline-lift-dot)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--discipline-lift-dot)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#es-lift-fill)" />
        <line
          x1={0}
          y1={prY}
          x2={w}
          y2={prY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <text x={6} y={prY - 6} className="fill-[var(--faint)]" style={{ fontSize: 11 }}>
          logged PR {pr} {record.unit}
        </text>
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={LIFT}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={5} fill="var(--warning)" />
        <text
          x={last.x - 8}
          y={last.y - 12}
          textAnchor="end"
          className="fill-[var(--foreground)]"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {points[points.length - 1]}
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] text-[var(--faint)]">
        Estimated 1RM over your last six sessions
      </p>
    </div>
  );
}

function SupportingLifts({ active, onPick }: { active: string; onPick: (n: string) => void }) {
  return (
    <div>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        All headline lifts
      </p>
      <ul className="divide-y divide-[var(--border)]">
        {LIFTS.map((r) => {
          const d = deriveLift(r);
          const isActive = r.exercise_name === active;
          return (
            <li key={r.exercise_name}>
              <button
                onClick={() => d.hasPR && onPick(r.exercise_name)}
                className={`flex w-full items-center justify-between gap-4 py-3 text-left transition ${
                  d.hasPR ? "hover:opacity-100" : "cursor-default"
                } ${isActive ? "opacity-100" : "opacity-80"}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: !d.hasPR ? "var(--faint)" : d.due ? "var(--warning)" : LIFT,
                    }}
                  />
                  <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                    {r.exercise_name}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                      in focus
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-6 tabular-nums">
                  {d.hasPR && d.due && d.gap !== null ? (
                    <span className="text-xs text-[var(--success)]">+{Math.round(d.gap)}</span>
                  ) : (
                    <span className="text-xs text-[var(--faint)]">{d.hasPR ? "on est" : "—"}</span>
                  )}
                  <span className="w-20 text-right text-sm font-medium">
                    {d.hasPR ? `${record1rm(r)} ${r.unit}` : "untested"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function record1rm(r: LiftRecord): number | string {
  return r.current_estimated_1rm ?? "—";
}

// ── Run hero ──────────────────────────────────────────────────────────────
function RunHero() {
  const e = MAX_EFFORT_5K;
  const gap = e.actual_best_seconds - e.seconds;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warning)]">
          Trending toward a 5K PR
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">5K max effort</h3>
        <p className="mt-5 flex items-baseline gap-2">
          <span className="text-5xl font-semibold tabular-nums tracking-[-0.03em]">
            {formatDuration(e.seconds)}
          </span>
          <span className="text-base text-[var(--muted)]">projected</span>
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          Your fitted curve now projects{" "}
          <span className="font-semibold text-[var(--warning)]">{formatSignedDuration(-gap)}</span>{" "}
          under your logged best of {formatDuration(e.actual_best_seconds)} —{" "}
          {humanizeConfidence(e.confidence)} confidence, band {formatDuration(e.lower_seconds)}–
          {formatDuration(e.upper_seconds)}. A fresh 5K could land a new best.
        </p>
      </div>
      <HeroRunChart />
    </div>
  );
}

function HeroRunChart() {
  const e = MAX_EFFORT_5K;
  const w = 460;
  const h = 200;
  const lows = e.estimate_history.map((p) => p.lower_seconds);
  const highs = e.estimate_history.map((p) => p.upper_seconds);
  const min = Math.min(...lows, e.actual_best_seconds) - 12;
  const max = Math.max(...highs) + 12;
  const mid = scaleSeries(
    e.estimate_history.map((p) => p.seconds),
    w,
    h,
    16,
    { min, max },
  );
  const up = scaleSeries(highs, w, h, 16, { min, max });
  const lo = scaleSeries(lows, w, h, 16, { min, max });
  const bestY = scaleY(e.actual_best_seconds, min, max, h, 16);
  const band = `${up.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} ${lo
    .slice()
    .reverse()
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")}`;
  const last = mid[mid.length - 1];
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--background)] p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <polygon points={band} fill="var(--discipline-run-bg)" opacity={0.8} />
        <line
          x1={0}
          y1={bestY}
          x2={w}
          y2={bestY}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <text x={6} y={bestY - 6} className="fill-[var(--faint)]" style={{ fontSize: 11 }}>
          logged best {formatDuration(e.actual_best_seconds)}
        </text>
        <polyline
          points={mid.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={RUN}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={5} fill="var(--warning)" />
      </svg>
      <p className="mt-1 text-center text-[11px] text-[var(--faint)]">
        Projected 5K time over the last four months (shaded = confidence band)
      </p>
    </div>
  );
}

function SupportingRunning() {
  return (
    <div>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        All distances
      </p>
      <ul className="divide-y divide-[var(--border)]">
        {RUNNING.map((r) => {
          const filled = r.duration_seconds !== null;
          return (
            <li
              key={r.distance_key}
              className={`flex items-center justify-between gap-4 py-3 ${filled ? "" : "opacity-60"}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: filled ? RUN : "var(--faint)" }}
                />
                <span className="text-sm font-medium">{r.distance_label}</span>
              </div>
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-xs text-[var(--faint)]">
                  {filled ? formatPace(r.pace_sec_per_km) : "not covered"}
                </span>
                <span className="w-20 text-right text-sm font-medium">
                  {filled ? formatDuration(r.duration_seconds) : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

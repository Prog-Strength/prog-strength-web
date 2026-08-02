/**
 * VARIANT — balance-band  ·  Proposed title: "HRV Balance"
 * Idiom: HEROES THE BAND. Draws on OURA's "your normal range" band treatment —
 * the personal balanced zone (baseline ± 1 SD) drawn as a filled horizontal
 * band behind a 30-day HRV series, so "am I inside my normal range?" is a
 * spatial question, not arithmetic. Today's point is marked and carries the
 * status color; the baseline is a faint centre line through the band.
 *
 * Type scale: modest headline over a chart that OWNS the card — the chart is
 * the hierarchy. Color logic: the HRV axis carries ALL color (band fill in
 * desaturated success, today's point in warning when suppressed / accent when
 * elevated); recovery score is absent. Spacing: chart-dominant, near-full-bleed
 * within the padding, tight gutters.
 *
 * Throwaway DX mockup — self-contained, no shared abstraction by design.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard } from "../_shell";
import { hrvStatusColor, statusWord } from "../_util";

const TITLE = "HRV Balance";
const W = 260;
const H = 92;
const PAD = 4;

export function BalanceBand({ view }: { view: RecoveryView }) {
  const { days, baseline, hrv } = view;

  // Guard once — render the calibrating state if the derived blocks are absent
  // OR the band has not been computed yet (a new user's first two weeks).
  if (!days || !baseline || !hrv || hrv.balancedLow === null || hrv.balancedHigh === null) {
    return (
      <MockCard title={TITLE}>
        <Calibrating days={baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const low = hrv.balancedLow;
  const high = hrv.balancedHigh;
  const base = baseline.hrvAvg;
  const hrvSeries = days.map((d) => d.hrv);
  const known = hrvSeries.filter((v): v is number => v !== null);

  // Scale spans the union of the series and the band, with a little headroom.
  const lo = Math.min(low, ...known) - 4;
  const hi = Math.max(high, ...known) + 4;
  const span = hi - lo || 1;
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const x = (i: number) => (i / (days.length - 1)) * W;

  // Break the polyline into gap-free segments (never interpolate across a null).
  const segments: string[] = [];
  let run: string[] = [];
  hrvSeries.forEach((v, i) => {
    if (v === null) {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
    } else {
      run.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    }
  });
  if (run.length > 1) segments.push(run.join(" "));

  const todayIdx = days.length - 1;
  const todayVal = days[todayIdx].hrv;
  const statusColor = hrvStatusColor(hrv.status);
  const hasToday = todayVal !== null;

  return (
    <MockCard title={TITLE}>
      {/* Modest headline: today's HRV ms + the status word beside it. */}
      <div className="flex items-baseline gap-2">
        {hasToday ? (
          <>
            <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {todayVal}
              <span className="ml-0.5 text-xs font-medium text-[var(--muted)]">ms</span>
            </span>
            <span className="text-sm font-medium" style={{ color: statusColor }}>
              {statusWord(hrv.status)}
            </span>
          </>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            No reading yet · band{" "}
            <span className="font-mono tabular-nums text-[var(--foreground)]">
              {Math.round(low)}–{Math.round(high)}
            </span>{" "}
            ms
          </span>
        )}
      </div>

      {/* Chart owns the card. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[92px] w-full"
        role="img"
        aria-label="Thirty-day HRV against your balanced band"
      >
        {/* The balanced band — the hero. Desaturated success fill. */}
        <rect
          x={0}
          y={y(high)}
          width={W}
          height={Math.max(0, y(low) - y(high))}
          fill="var(--success)"
          fillOpacity={0.12}
        />
        {/* Baseline centre line through the band — faint. */}
        {base !== null && (
          <line
            x1={0}
            x2={W}
            y1={y(base)}
            y2={y(base)}
            stroke="var(--success)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* HRV series — calm muted ink; the band, not the line, carries color. */}
        {segments.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Today's point, marked in the status color. */}
        {hasToday && (
          <circle
            cx={x(todayIdx)}
            cy={y(todayVal!)}
            r={3.5}
            fill={statusColor}
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Neutral caption — the band bounds spelled out, no second color axis. */}
      <p className="text-[11px] text-[var(--faint)]">
        Your balanced range{" "}
        <span className="font-mono tabular-nums text-[var(--muted)]">
          {Math.round(low)}–{Math.round(high)} ms
        </span>{" "}
        · baseline{" "}
        <span className="font-mono tabular-nums text-[var(--muted)]">
          {base !== null ? Math.round(base) : "—"} ms
        </span>
      </p>
    </MockCard>
  );
}

/** New-user state — no band to draw. Honest progress toward calibration. */
function Calibrating({ days }: { days: number }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (days / 14) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">{days} of 14</span> nights ·
        your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}

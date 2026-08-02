/**
 * HrvBalanceCard — the `hrv_balance` tile ("HRV Balance").
 *
 * Heroes the BAND: the athlete's own balanced zone (server `balancedLow`–
 * `balancedHigh`, baseline ± 1 of their own SDs — never a generic "normal HRV"
 * range) drawn as a filled horizontal zone behind the 30-day series, so "am I
 * inside my normal range?" is a spatial question. The HRV axis carries ALL the
 * color on this tile: band fill in desaturated success, today's point in the
 * status color; the series stays muted ink and the recovery score is absent.
 *
 * The polyline splits into gap-free segments — a null day breaks the line
 * rather than interpolating across it. Bounds null (calibrating) renders the
 * honest n-of-14 progress state: no band drawn at zero, no empty chart frame.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { hrvStatusColor, statusWord } from "./shared";

const TITLE = "HRV Balance";
const W = 260;
const H = 92;
const PAD = 4;

export function HrvBalanceCard({ section, href }: { section: RecoveryView; href: string }) {
  const { days, baseline, hrv } = section;

  // Guard once — calibrating until the derived blocks and both bounds exist.
  if (!days || !baseline || !hrv || hrv.balancedLow === null || hrv.balancedHigh === null) {
    return (
      <MiniCard title={TITLE} href={href}>
        <Calibrating nights={baseline?.hrvDays ?? 0} />
      </MiniCard>
    );
  }

  const low = hrv.balancedLow;
  const high = hrv.balancedHigh;
  const base = baseline.hrvAvg;
  const hrvSeries = days.map((d) => d.hrv);
  const known = hrvSeries.filter((v): v is number => v !== null);

  // Scale spans the union of the series and the band, with headroom.
  const lo = Math.min(low, ...known) - 4;
  const hi = Math.max(high, ...known) + 4;
  const span = hi - lo || 1;
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const x = (i: number) => (i / Math.max(1, days.length - 1)) * W;

  // Break the polyline into gap-free segments — never interpolate a null.
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
  const todayVal = hrvSeries[todayIdx];
  const statusColor = hrvStatusColor(hrv.status);

  return (
    <MiniCard title={TITLE} href={href}>
      {/* Modest headline: today's ms + status word, or the bounds when absent. */}
      <div className="flex items-baseline gap-2">
        {todayVal !== null ? (
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
              {Math.round(low)}–{Math.round(high)} ms
            </span>
          </span>
        )}
      </div>

      {/* The chart owns the card. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[92px] w-full"
        role="img"
        aria-label="Thirty-day HRV against your balanced band"
      >
        <rect
          x={0}
          y={y(high)}
          width={W}
          height={Math.max(0, y(low) - y(high))}
          fill="var(--success)"
          fillOpacity={0.12}
        />
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
        {todayVal !== null && (
          <circle
            cx={x(todayIdx)}
            cy={y(todayVal)}
            r={3.5}
            fill={statusColor}
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Neutral caption — the bounds spelled out; no second color axis. */}
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
    </MiniCard>
  );
}

/** New-user state — no band to draw yet. Honest progress toward 14 nights. */
function Calibrating({ nights }: { nights: number }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (nights / 14) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">{nights} of 14</span> nights ·
        your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}

"use client";

/**
 * IDIOM: projection-chart-forward — draws on FiveThirtyEight's forecast cones.
 *
 * The estimate-over-time chart is the hero: enlarged, near-full-bleed, with the
 * confidence band drawn as a prominent CONE OF UNCERTAINTY that visibly widens
 * into the forward projection, and the real attempts scattered as dots against
 * it. The stat tiles compress to a thin caption strip above the plot.
 *
 * Hand-rolled SVG (not the production recharts component) so the cone, the
 * inverted "lower is faster" axis, and the forward widening are fully under the
 * variant's control — and so this throwaway never couples to shipped chart code.
 *
 * DIVERGES ON (in-system):
 *  · type scale — chart-scale: the plot dominates, numbers become axis/annotation.
 *  · color logic — accent line + soft accent band fill; attempts in the sage
 *    (accent-2) hue; the forward cone a fainter dashed accent.
 *  · spacing rhythm — the chart claims the panel; chrome is a single caption row.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import { confidenceLevel, estimateTrend, fmtTime } from "../_shared/format";

const W = 820;
const H = 360;
const PAD = { t: 24, r: 20, b: 34, l: 60 };

export function ProjectionChartForward({ detail }: { detail: RunningMaxEffortDetail }) {
  const est = detail.estimate;
  const history = detail.estimate_history;
  const trend = estimateTrend(history);
  const conf = confidenceLevel(detail.stats.confidence);

  if (!est || history.length < 2) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center px-8 py-16 text-center">
        <div className="mb-5 h-24 w-48 rounded-md border border-dashed border-[var(--border-strong)]" />
        <p className="max-w-xs text-sm text-[var(--muted)]">
          Two or more efforts at the {detail.distance_label} draw the projection cone. Log a run to
          start the chart.
        </p>
      </div>
    );
  }

  // ---- domains ---------------------------------------------------------
  const t0 = new Date(history[0].as_of).getTime();
  const tLast = new Date(history[history.length - 1].as_of).getTime();
  const span = Math.max(1, tLast - t0);
  const tFuture = tLast + span * 0.42; // forward horizon for the cone

  const attempts = detail.attempts.map((a) => ({
    t: new Date(a.achieved_at).getTime(),
    sec: a.duration_seconds,
  }));

  const lowers = history.map((p) => p.lower_seconds);
  const uppers = history.map((p) => p.upper_seconds);
  // forward cone widens from the last band to ~1.9× its half-width
  const lastSec = history[history.length - 1].seconds;
  const lastHalf =
    (history[history.length - 1].upper_seconds - history[history.length - 1].lower_seconds) / 2;
  const coneHalf = lastHalf * 1.9;
  const coneUpper = lastSec + coneHalf;
  const coneLower = lastSec - coneHalf;

  const secMin = Math.min(...lowers, coneLower, ...attempts.map((a) => a.sec));
  const secMax = Math.max(...uppers, coneUpper, ...attempts.map((a) => a.sec));
  const yPad = (secMax - secMin) * 0.08 || 30;
  const yMin = secMin - yPad;
  const yMax = secMax + yPad;

  const x = (t: number) => PAD.l + ((t - t0) / (tFuture - t0)) * (W - PAD.l - PAD.r);
  // inverted: lower seconds (faster) sit HIGHER on the plot
  const y = (sec: number) => PAD.t + ((sec - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  // ---- geometry --------------------------------------------------------
  const bandPath =
    history.map((p) => `${x(new Date(p.as_of).getTime())},${y(p.upper_seconds)}`).join(" L ") +
    " L " +
    history
      .slice()
      .reverse()
      .map((p) => `${x(new Date(p.as_of).getTime())},${y(p.lower_seconds)}`)
      .join(" L ");

  const conePath = [
    `${x(tLast)},${y(history[history.length - 1].upper_seconds)}`,
    `${x(tFuture)},${y(coneUpper)}`,
    `${x(tFuture)},${y(coneLower)}`,
    `${x(tLast)},${y(history[history.length - 1].lower_seconds)}`,
  ].join(" L ");

  const linePath = history
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(new Date(p.as_of).getTime())} ${y(p.seconds)}`)
    .join(" ");

  // y gridlines at a few round clock values
  const ticks = niceTicks(yMin, yMax, 4);

  const trendColor =
    trend.tone === "positive"
      ? "var(--success)"
      : trend.tone === "negative"
        ? "var(--danger)"
        : "var(--muted)";

  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      {/* thin caption strip — the stat tiles, compressed */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span className="text-[var(--muted)]">
          Now{" "}
          <span className="font-semibold tabular-nums text-[var(--accent)]">
            {fmtTime(est.seconds)}
          </span>
        </span>
        <span className="text-[var(--muted)]">
          Range{" "}
          <span className="tabular-nums text-[var(--foreground)]">
            {fmtTime(est.lower_seconds)}–{fmtTime(est.upper_seconds)}
          </span>
        </span>
        <span className="text-[var(--muted)]" style={{ color: trendColor }}>
          {trend.arrow} {trend.phrase}
        </span>
        <span className="ml-auto text-xs text-[var(--faint)]">
          {conf.label} confidence · lower is faster
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Estimate projection">
        <defs>
          <linearGradient id="dx-cone-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((tk) => (
          <g key={tk}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(tk)}
              y2={y(tk)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 10}
              y={y(tk) + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--faint)"
              className="tabular-nums"
            >
              {fmtTime(tk)}
            </text>
          </g>
        ))}

        {/* historical confidence band */}
        <path d={`M ${bandPath} Z`} fill="url(#dx-cone-band)" stroke="none" />

        {/* forward cone of uncertainty (dashed, widening) */}
        <path
          d={`M ${conePath} Z`}
          fill="var(--accent-soft)"
          stroke="var(--accent-line)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* projected centre line into the future */}
        <line
          x1={x(tLast)}
          y1={y(lastSec)}
          x2={x(tFuture)}
          y2={y(lastSec)}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.7}
        />
        <text x={x(tFuture)} y={y(lastSec) - 8} textAnchor="end" fontSize={11} fill="var(--accent)">
          projected
        </text>

        {/* estimate line */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.5} />

        {/* attempts — sage dots; a proof faster than the band sits ABOVE it */}
        {attempts.map((a, i) => (
          <g key={i}>
            <circle
              cx={x(a.t)}
              cy={y(a.sec)}
              r={5}
              fill="var(--accent-2)"
              stroke="var(--background)"
              strokeWidth={1.5}
            />
          </g>
        ))}

        {/* "now" divider */}
        <line
          x1={x(tLast)}
          y1={PAD.t}
          x2={x(tLast)}
          y2={H - PAD.b}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
        <text x={x(tLast) + 5} y={PAD.t + 10} fontSize={10} fill="var(--faint)">
          now
        </text>
      </svg>

      <div className="flex items-center gap-4 px-1 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-[var(--accent)]" /> estimate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-2)]" /> logged effort
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-[var(--accent-line)] bg-[var(--accent-soft)]" />{" "}
          uncertainty
        </span>
      </div>
    </div>
  );
}

/** A handful of evenly-spaced round clock values across a seconds domain. */
function niceTicks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / count;
  const step = raw <= 30 ? 30 : raw <= 60 ? 60 : raw <= 120 ? 120 : Math.ceil(raw / 300) * 300;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max; v += step) out.push(v);
  return out;
}

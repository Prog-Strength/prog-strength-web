"use client";

/**
 * Shared featured estimation chart for the personal-records master/detail
 * view. Both the lift detail pane (est-1RM line) and the run detail pane
 * (estimate-seconds line plus a confidence band) render through this one
 * component; the variant is selected entirely by props (no `kind` switch):
 *
 *   - Lifts:   a single est-1RM line; higher is better; default line color.
 *   - Running: pass `hasBand` to draw the stacked-Area confidence band and
 *              `lowerIsFasterNote` so the downward-good slope doesn't read as
 *              a regression.
 *
 * The one capability beyond the original per-card progression / estimate
 * charts it was distilled from is a dashed horizontal ReferenceLine at the
 * logged PR/best, with the Y domain widened to always include it so the line
 * is visible.
 *
 * This component renders no title — the detail panes own their headings.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tooltipContentStyle } from "@/app/(app)/running/_components/HeartRateChart";

const CHART_HEIGHT = 240;
// Fallback width used only when ResponsiveContainer cannot measure its parent
// (e.g. jsdom); at runtime the real ResponsiveContainer overrides it.
const CHART_WIDTH_FALLBACK = 600;

export type FeaturedPoint = {
  t: number; // epoch ms (X)
  value: number; // metric (Y): est-1RM (lift) or estimate seconds (run)
  lower?: number; // band floor (running only)
  upper?: number; // band ceiling (running only)
};

export type FeaturedEstimateChartProps = {
  data: FeaturedPoint[];
  referenceValue: number; // dashed line height (logged PR weight / best seconds)
  referenceLabel: string; // e.g. "logged PR 305 lb" / "logged best 19:45"
  formatY: (v: number) => string; // Y tick + tooltip formatter
  hasBand?: boolean; // render the confidence band (running)
  lowerIsFasterNote?: boolean; // show the "lower is faster" caption (running)
  lineColor?: string; // CSS var string; default "var(--discipline-lift-dot)"
  isPending?: boolean;
  isError?: boolean;
};

/** Short date tick for the X axis, e.g. "Apr 18". */
function dateTick(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type BandDatum = FeaturedPoint & { height: number };

export function FeaturedEstimateChart({
  data,
  referenceValue,
  referenceLabel,
  formatY,
  hasBand,
  lowerIsFasterNote,
  lineColor,
  isPending,
  isError,
}: FeaturedEstimateChartProps) {
  const stroke = lineColor ?? "var(--discipline-lift-dot)";

  const note = lowerIsFasterNote ? (
    <p className="text-[10px] text-[var(--muted)]">lower is faster</p>
  ) : null;

  if (isPending) {
    return (
      <div>
        {note}
        <div
          className="mt-2 w-full animate-pulse rounded-md bg-[var(--surface-2)]"
          style={{ height: CHART_HEIGHT }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        {note}
        <p className="mt-2 text-xs text-[var(--muted)]">Couldn&apos;t load history</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div>
        {note}
        <p className="mt-2 text-xs text-[var(--muted)]">No history yet</p>
      </div>
    );
  }

  if (data.length === 1) {
    const datum = data[0];
    return (
      <div>
        {note}
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-sm font-medium tabular-nums">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--warning)] align-middle" />
            {formatY(datum.value)}
            <span className="ml-2 text-xs text-[var(--muted)]">{dateTick(datum.t)}</span>
          </p>
          <p className="text-xs text-[var(--muted)]">Not enough data yet</p>
        </div>
      </div>
    );
  }

  const chartData: BandDatum[] = data.map((p) => ({
    ...p,
    height: Math.max(0, (p.upper ?? p.value) - (p.lower ?? p.value)),
  }));
  const lastIndex = chartData.length - 1;

  return (
    <div>
      {note}
      <div className="mt-2 w-full">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          {/* `width`/`height` are fallbacks: at runtime ResponsiveContainer
              re-injects the measured size, but they let the chart size itself
              in non-measuring environments (e.g. jsdom under test). */}
          <ComposedChart
            data={chartData}
            width={CHART_WIDTH_FALLBACK}
            height={CHART_HEIGHT}
            margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id="featured-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              stroke="var(--muted)"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={dateTick}
            />
            <YAxis
              stroke="var(--muted)"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              width={52}
              domain={[
                (min: number) => Math.min(min, referenceValue),
                (max: number) => Math.max(max, referenceValue),
              ]}
              tickFormatter={formatY}
            />
            <Tooltip
              cursor={{ stroke: "#52525b", strokeWidth: 1 }}
              contentStyle={tooltipContentStyle}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(v) => dateTick(Number(v))}
              formatter={(v) => [formatY(Number(v)), ""]}
            />

            {hasBand && (
              <>
                {/* Confidence band: a transparent floor at `lower`, then a
                    gradient-filled band of `height` stacked on top so its
                    top edge sits at `upper`. */}
                <Area
                  stackId="band"
                  dataKey="lower"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  activeDot={false}
                  legendType="none"
                  name="lower"
                />
                <Area
                  stackId="band"
                  dataKey="height"
                  stroke="none"
                  fill="url(#featured-band)"
                  isAnimationActive={false}
                  activeDot={false}
                  legendType="none"
                  name="band"
                />
              </>
            )}

            <ReferenceLine
              y={referenceValue}
              stroke="var(--faint)"
              strokeDasharray="4 4"
              label={{
                value: referenceLabel,
                position: "insideTopLeft",
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />

            <Line
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) =>
                props.index === lastIndex ? (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill="var(--warning)"
                    stroke="none"
                  />
                ) : (
                  <g key={props.index} />
                )
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

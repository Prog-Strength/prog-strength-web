"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BloodPressureEntry } from "@/lib/api";
import { BP_CATEGORIES, classify, dailyAverages, type BpCategory } from "@/lib/blood-pressure";
import { BP_CHART_COLORS } from "@/lib/blood-pressure-chart-colors";
import { StatTile } from "@/components/stat-tile";

/**
 * The blood-pressure hero. A layered Recharts ComposedChart (back → front):
 *
 *   1. A shaded healthy band — a ReferenceArea tinting the normal zone up
 *      to the stage-1 reference lines. See the band comment below.
 *   2. Dashed ReferenceLines at 130 (systolic) and 80 (diastolic).
 *   3. Systolic daily-average line (heavier, accent) and diastolic
 *      daily-average line (lighter, muted). Both plot dailyAverages(...)
 *      with GAPS for missing days (null y + connectNulls={false}), so a
 *      hole is never interpolated across and a day is never drawn as 0.
 *
 * The y-domain is a function that always widens to include both the 80
 * and 130 reference lines (plus padding), so the 130 line is visible even
 * when every reading sits at 110/70. Below the chart, four StatTiles
 * (Average, Latest, In-normal-range, Readings) sit INSIDE the same
 * bordered box, computed over the passed (already range-filtered) entries.
 *
 * Mirrors app/(app)/bodyweight/_components/trend-section.tsx.
 */

// The stage-1 cutoffs the healthy band tops out at — same numbers the
// classifier and reference lines use.
const SYS_REF = 130;
const DIA_REF = 80;

type ChartPoint = {
  t: number; // local-day midnight epoch ms — the x value
  systolic: number | null; // daily-average systolic; null on a gap day
  diastolic: number | null; // daily-average diastolic; null on a gap day
  count: number; // readings that day (0 on a gap day)
  category: BpCategory | null; // the day's daily-average category; null on a gap
};

export function BpTrendCard({
  entries,
  timeZone,
  isMobile,
}: {
  entries: BloodPressureEntry[];
  timeZone: string;
  isMobile: boolean;
}) {
  const { chartData, stats } = useMemo(() => derive(entries, timeZone), [entries, timeZone]);

  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No readings in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <Legend />

      <div className="h-[300px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: isMobile ? 8 : 16, bottom: 8, left: 0 }}
          >
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              stroke={BP_CHART_COLORS.axis}
              tick={{ fill: BP_CHART_COLORS.axis, fontSize: 11 }}
              minTickGap={isMobile ? 24 : 12}
              tickFormatter={(v: number) => {
                const d = new Date(v);
                if (isMobile) return `${d.getMonth() + 1}/${d.getDate()}`;
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              stroke={BP_CHART_COLORS.axis}
              tick={{ fill: BP_CHART_COLORS.axis, fontSize: 11 }}
              // Always include both reference lines (80 and 130) plus the
              // band, so the guideline lines stay on-screen even when every
              // reading sits well below them.
              domain={[
                (dataMin: number) => Math.floor(Math.min(dataMin, DIA_REF) - 6),
                (dataMax: number) => Math.ceil(Math.max(dataMax, SYS_REF) + 6),
              ]}
              width={isMobile ? 32 : 44}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            {/* Healthy band: a single ReferenceArea tinting the zone from the
                y-floor up to the systolic stage-1 line (130). Readings whose
                daily-average systolic sits inside this band are in or near the
                normal range; crossing above it means the trend has entered
                elevated / stage-1 territory. A single low-alpha fill keeps the
                chart calm rather than stacking two overlapping bands. */}
            <ReferenceArea
              y1={0}
              y2={SYS_REF}
              fill={BP_CHART_COLORS.bandFill}
              stroke="none"
              ifOverflow="extendDomain"
            />
            <ReferenceLine
              y={SYS_REF}
              stroke={BP_CHART_COLORS.reference}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{
                value: isMobile ? "130" : "Systolic 130",
                position: "insideTopRight",
                fill: BP_CHART_COLORS.reference,
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={DIA_REF}
              stroke={BP_CHART_COLORS.reference}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{
                value: isMobile ? "80" : "Diastolic 80",
                position: "insideBottomRight",
                fill: BP_CHART_COLORS.reference,
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ stroke: BP_CHART_COLORS.axis, strokeWidth: 1 }}
              wrapperStyle={{ outline: "none" }}
              content={<BpTooltip />}
            />
            <Line
              type="monotone"
              dataKey="systolic"
              stroke={BP_CHART_COLORS.systolic}
              strokeWidth={2.5}
              connectNulls={false}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              stroke={BP_CHART_COLORS.diastolic}
              strokeWidth={1.5}
              connectNulls={false}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stat tiles tucked inside the same box, below the chart. */}
      <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-4">
        <StatTile
          label="Average"
          value={stats.avg ? `${stats.avg.systolic}/${stats.avg.diastolic}` : "—"}
          sub={stats.avg ? "mmHg" : undefined}
        />
        <StatTile
          label="Latest"
          value={stats.latest ? `${stats.latest.systolic}/${stats.latest.diastolic}` : "—"}
          sub={stats.latest ? BP_CATEGORIES[stats.latest.category].label : undefined}
        />
        <StatTile
          label="In normal range"
          value={stats.normalPct !== null ? `${stats.normalPct}%` : "—"}
          sub={`${stats.normalCount}/${stats.total} readings`}
        />
        <StatTile
          label="Readings"
          value={String(stats.total)}
          sub={`${stats.days} day${stats.days === 1 ? "" : "s"}`}
        />
      </div>
    </div>
  );
}

// --- legend -------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
      <LegendItem
        swatch={
          <span
            className="inline-block h-[3px] w-5 rounded-full"
            style={{ background: BP_CHART_COLORS.systolic }}
          />
        }
        label="Systolic"
      />
      <LegendItem
        swatch={
          <span
            className="inline-block h-[2px] w-5 rounded-full"
            style={{ background: BP_CHART_COLORS.diastolic }}
          />
        }
        label="Diastolic"
      />
      <LegendItem
        swatch={
          <span
            className="inline-block w-5 border-t-2 border-dashed"
            style={{ borderColor: BP_CHART_COLORS.reference }}
          />
        }
        label="130 / 80 guideline"
      />
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{swatch}</span>
      {label}
    </span>
  );
}

// --- tooltip ------------------------------------------------------

type TooltipPayloadItem = { payload?: ChartPoint };

/**
 * Custom tooltip: shows both numbers `122/78`, the day, that day's reading
 * count, and the day's daily-average category. Reads the whole ChartPoint
 * off the first payload item's `payload` (both lines share it). Exported so
 * a test can target it without recharts layout. Gap days (null y) never
 * produce a hover, so `systolic`/`diastolic` are non-null here.
 */
export function BpTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number | string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point || point.systolic === null || point.diastolic === null) return null;

  return (
    <div
      style={{
        backgroundColor: BP_CHART_COLORS.tooltipSurface,
        border: `1px solid ${BP_CHART_COLORS.tooltipBorder}`,
        borderRadius: "0.5rem",
        padding: "8px 10px",
        fontSize: "12px",
      }}
    >
      <p className="mb-1 text-[var(--muted)]">{formatTooltipDay(label)}</p>
      <p className="tabular-nums text-[var(--foreground)]">
        <span className="text-[var(--muted)]">Daily avg: </span>
        {point.systolic}/{point.diastolic} mmHg
      </p>
      {point.category && (
        <p className="text-[var(--muted)]">
          {BP_CATEGORIES[point.category].label} · {point.count} reading
          {point.count === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function formatTooltipDay(label: number | string | undefined): string {
  const v = typeof label === "number" ? label : Number(label);
  if (!Number.isFinite(v)) return "";
  return new Date(v).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- derivation ---------------------------------------------------

type Stats = {
  avg: { systolic: number; diastolic: number } | null;
  latest: { systolic: number; diastolic: number; category: BpCategory } | null;
  normalPct: number | null;
  normalCount: number;
  total: number;
  days: number;
};

function derive(
  entries: BloodPressureEntry[],
  timeZone: string,
): {
  chartData: ChartPoint[];
  stats: Stats;
} {
  const averages = dailyAverages(entries, timeZone);
  const chartData = buildContinuousDays(averages);

  const total = entries.length;
  let sumSys = 0;
  let sumDia = 0;
  let normalCount = 0;
  for (const e of entries) {
    sumSys += e.systolic;
    sumDia += e.diastolic;
    // Prefer the server-stored category; fall back to the client classifier
    // only if it's somehow absent (keeps the percentage honest).
    const cat = (e.category as BpCategory) ?? classify(e.systolic, e.diastolic);
    if (cat === "normal") normalCount += 1;
  }

  const avg =
    total > 0
      ? { systolic: Math.round(sumSys / total), diastolic: Math.round(sumDia / total) }
      : null;

  // Latest = most recent by measured_at.
  let latest: Stats["latest"] = null;
  if (total > 0) {
    const newest = entries.reduce((a, b) =>
      new Date(b.measured_at).getTime() > new Date(a.measured_at).getTime() ? b : a,
    );
    latest = {
      systolic: newest.systolic,
      diastolic: newest.diastolic,
      category: (newest.category as BpCategory) ?? classify(newest.systolic, newest.diastolic),
    };
  }

  return {
    chartData,
    stats: {
      avg,
      latest,
      normalPct: total > 0 ? Math.round((normalCount / total) * 100) : null,
      normalCount,
      total,
      days: averages.length,
    },
  };
}

/**
 * Turn the sparse daily-average list (only days with readings) into a
 * continuous per-day series from the first to the last day, inserting
 * null-y points for missing days. With connectNulls={false} those nulls
 * render as GAPS — the lines are never interpolated across a hole, and a
 * missing day is never drawn as 0. The x value is local-midnight epoch ms
 * for each "YYYY-MM-DD" key.
 */
function buildContinuousDays(averages: ReturnType<typeof dailyAverages>): ChartPoint[] {
  if (averages.length === 0) return [];
  const byDay = new Map(averages.map((a) => [a.day, a]));
  const first = dayKeyToLocalMidnight(averages[0].day);
  const last = dayKeyToLocalMidnight(averages[averages.length - 1].day);

  const points: ChartPoint[] = [];
  const cursor = new Date(first);
  // Guard the loop so a pathological range can't spin forever.
  let safety = 0;
  while (cursor.getTime() <= last && safety < 5000) {
    const key = localKey(cursor);
    const a = byDay.get(key);
    points.push(
      a
        ? {
            t: cursor.getTime(),
            systolic: a.systolic,
            diastolic: a.diastolic,
            count: a.count,
            category: a.category,
          }
        : { t: cursor.getTime(), systolic: null, diastolic: null, count: 0, category: null },
    );
    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }
  return points;
}

/** "YYYY-MM-DD" → local-midnight Date (explicit components, no UTC shift). */
function dayKeyToLocalMidnight(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Local "YYYY-MM-DD" for a Date. */
function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

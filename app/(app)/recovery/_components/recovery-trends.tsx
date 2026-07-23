import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WhoopRecoveryDay } from "@/lib/api";
import { toChartRows } from "@/lib/recovery";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_RECOVERY_AVG,
  CHART_RECOVERY_BAND_DANGER,
  CHART_RECOVERY_BAND_SUCCESS,
  CHART_RECOVERY_BAND_WARNING,
  CHART_RECOVERY_HRV,
  CHART_RECOVERY_RHR,
  CHART_RECOVERY_SCORE,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_RADIUS,
  RECOVERY_BAND_FILL_OPACITY,
} from "@/lib/chart-colors";

/**
 * Three trend panels — recovery score, resting HR, HRV — over the fetched
 * range. The metrics share no axis, so each gets its own panel: score is fixed
 * 0-100 with translucent band zones; resting HR and HRV auto-fit with a dashed
 * range-average reference line. Null days are gaps (connectNulls off), never
 * zeros. Responsive grid: stacked narrow, side-by-side where there's room.
 */
export function RecoveryTrends({ rows }: { rows: WhoopRecoveryDay[] }) {
  const data = toChartRows(rows);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ScorePanel data={data} />
      <MetricPanel
        title="Resting heart rate"
        data={data}
        dataKey="resting_heart_rate"
        stroke={CHART_RECOVERY_RHR}
        unit="bpm"
      />
      <MetricPanel
        title="HRV"
        data={data}
        dataKey="hrv_rmssd_milli"
        stroke={CHART_RECOVERY_HRV}
        unit="ms"
      />
    </div>
  );
}

function ScorePanel({ data }: { data: WhoopRecoveryDay[] }) {
  return (
    <Panel title="Recovery score">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
          <ReferenceArea
            y1={0}
            y2={33}
            fill={CHART_RECOVERY_BAND_DANGER}
            fillOpacity={RECOVERY_BAND_FILL_OPACITY}
            ifOverflow="hidden"
          />
          <ReferenceArea
            y1={34}
            y2={66}
            fill={CHART_RECOVERY_BAND_WARNING}
            fillOpacity={RECOVERY_BAND_FILL_OPACITY}
            ifOverflow="hidden"
          />
          <ReferenceArea
            y1={67}
            y2={100}
            fill={CHART_RECOVERY_BAND_SUCCESS}
            fillOpacity={RECOVERY_BAND_FILL_OPACITY}
            ifOverflow="hidden"
          />
          <XAxis
            dataKey="date"
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            minTickGap={16}
            tickFormatter={formatAxisDate}
          />
          <YAxis
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            width={36}
            domain={[0, 100]}
          />
          <Tooltip
            cursor={{ stroke: CHART_AXIS, strokeWidth: 1 }}
            wrapperStyle={{ outline: "none" }}
            contentStyle={tooltipStyle}
            labelFormatter={formatTooltipDate}
            formatter={(v) => [String(v), "Score"]}
          />
          <Line
            dataKey="recovery_score"
            stroke={CHART_RECOVERY_SCORE}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function MetricPanel({
  title,
  data,
  dataKey,
  stroke,
  unit,
}: {
  title: string;
  data: WhoopRecoveryDay[];
  dataKey: "resting_heart_rate" | "hrv_rmssd_milli";
  stroke: string;
  unit: string;
}) {
  const avg = mean(data.map((d) => d[dataKey]));
  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            minTickGap={16}
            tickFormatter={formatAxisDate}
          />
          <YAxis
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            width={36}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: CHART_AXIS, strokeWidth: 1 }}
            wrapperStyle={{ outline: "none" }}
            contentStyle={tooltipStyle}
            labelFormatter={formatTooltipDate}
            formatter={(v) => [`${v} ${unit}`, title]}
          />
          {avg !== null && (
            <ReferenceLine
              y={avg}
              stroke={CHART_RECOVERY_AVG}
              strokeDasharray="6 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                value: `avg ${Math.round(avg)} ${unit}`,
                position: "right",
                fill: CHART_RECOVERY_AVG,
                fontSize: 10,
              }}
            />
          )}
          <Line
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="h-[220px] w-full">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: CHART_TOOLTIP_RADIUS,
  padding: "8px 10px",
  fontSize: "12px",
} as const;

/** Mean of the non-null numbers, or null when there are none. */
function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatAxisDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

function formatTooltipDate(date: React.ReactNode): string {
  const [y, m, d] = String(date).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

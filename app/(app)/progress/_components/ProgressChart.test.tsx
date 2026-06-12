/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { ExerciseBaseline, MuscleGroupProgressionPoint, PerExerciseTrend } from "@/lib/api";
import { ProgressChart, directionLabel } from "./ProgressChart";

// Recharts renders poorly in jsdom (no layout), and we only care about the
// legend DOM (rendered outside the SVG by our own code) plus that no dashed
// top-level trendline node is emitted. Stub recharts to passthrough <g>-ish
// divs tagged with their component name so we can assert on them. The
// ProgressChart never renders a strokeDasharray on a <Line>, so asserting no
// such element exists guards against a regressed trend overlay.
vi.mock("recharts", () => {
  const stub = (name: string) =>
    function Stub(props: Record<string, unknown>) {
      const dataKey = typeof props.dataKey === "string" ? props.dataKey : undefined;
      const dashed = typeof props.strokeDasharray === "string" ? props.strokeDasharray : undefined;
      return (
        <div
          data-recharts={name}
          data-datakey={dataKey}
          data-dasharray={dashed}
          data-stroke={typeof props.stroke === "string" ? props.stroke : undefined}
        />
      );
    };
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-recharts="LineChart">{children}</div>
    ),
    Line: stub("Line"),
    CartesianGrid: stub("CartesianGrid"),
    XAxis: stub("XAxis"),
    YAxis: stub("YAxis"),
    Tooltip: stub("Tooltip"),
    ReferenceLine: stub("ReferenceLine"),
  };
});

const BASELINES: ExerciseBaseline[] = [
  { exercise_id: "up", exercise_name: "Up Lift", baseline: 200, unit: "lb" },
  { exercise_id: "flat", exercise_name: "Flat Lift", baseline: 150, unit: "lb" },
  { exercise_id: "thin", exercise_name: "Thin Lift", baseline: 100, unit: "lb" },
];

const TRENDS: PerExerciseTrend[] = [
  { exercise_id: "up", session_count: 8, slope_per_month: 2.1, trendline: null },
  { exercise_id: "flat", session_count: 6, slope_per_month: 0.1, trendline: null },
  { exercise_id: "thin", session_count: 2, slope_per_month: null, trendline: null },
];

function pt(
  exercise_id: string,
  exercise_name: string,
  normalized_max: number,
): MuscleGroupProgressionPoint {
  return {
    workout_id: `wk_${exercise_id}`,
    exercise_id,
    exercise_name,
    performed_at: "2026-04-01T00:00:00Z",
    normalized_max,
    avg_estimated_1rm: 100,
    max_estimated_1rm: 110,
    min_estimated_1rm: 90,
    set_count: 3,
    unit: "lb",
  };
}

const POINTS: MuscleGroupProgressionPoint[] = [
  pt("up", "Up Lift", 0.95),
  pt("flat", "Flat Lift", 0.9),
  pt("thin", "Thin Lift", 0.8),
];

describe("directionLabel", () => {
  it("maps a steep positive slope to ↑", () => {
    expect(
      directionLabel({ exercise_id: "x", session_count: 8, slope_per_month: 2.1, trendline: null }),
    ).toEqual({
      arrow: "↑",
      text: "+2.1%/mo",
      tone: "positive",
    });
  });
  it("maps a small slope to → flat", () => {
    expect(
      directionLabel({ exercise_id: "x", session_count: 6, slope_per_month: 0.1, trendline: null }),
    ).toEqual({
      arrow: "→",
      text: "+0.1%/mo",
      tone: "neutral",
    });
  });
  it("maps a steep negative slope to ↓ with a unicode minus", () => {
    expect(
      directionLabel({
        exercise_id: "x",
        session_count: 8,
        slope_per_month: -1.4,
        trendline: null,
      }),
    ).toEqual({
      arrow: "↓",
      text: "−1.4%/mo",
      tone: "negative",
    });
  });
  it("maps a null slope to no-arrow not-enough-data", () => {
    expect(
      directionLabel({
        exercise_id: "x",
        session_count: 2,
        slope_per_month: null,
        trendline: null,
      }),
    ).toEqual({
      arrow: null,
      text: "not enough data",
      tone: "neutral",
    });
  });
  it("treats an absent trend as not enough data", () => {
    expect(directionLabel(undefined)).toEqual({
      arrow: null,
      text: "not enough data",
      tone: "neutral",
    });
  });
});

describe("ProgressChart legend", () => {
  function renderChart() {
    return render(
      <ProgressChart
        points={POINTS}
        exerciseBaselines={BASELINES}
        perExerciseTrends={TRENDS}
        muscleGroupsIncluded={["chest", "shoulders", "triceps"]}
        exerciseColors={
          new Map([
            ["up", "#3b82f6"],
            ["flat", "#f59e0b"],
            ["thin", "#10b981"],
          ])
        }
      />,
    );
  }

  it("renders each legend entry's slope readout and arrow", () => {
    renderChart();
    expect(screen.getByText("+2.1%/mo")).toBeInTheDocument();
    expect(screen.getByText("+0.1%/mo")).toBeInTheDocument();
    expect(screen.getByText("not enough data")).toBeInTheDocument();

    // Arrows carry accessible labels so the glyph isn't the sole signal.
    expect(screen.getByRole("img", { name: "trending up" })).toHaveTextContent("↑");
    expect(screen.getByRole("img", { name: "flat" })).toHaveTextContent("→");
    // The thin lift (null slope) renders no arrow image.
    expect(screen.queryByRole("img", { name: "trending down" })).toBeNull();
  });

  it("renders the Showing caption from muscle_groups_included, title-cased", () => {
    renderChart();
    expect(screen.getByText("Showing: Chest, Shoulders, Triceps")).toBeInTheDocument();
  });

  it("renders no dashed top-level trendline node", () => {
    const { container } = renderChart();
    const dashedLines = container.querySelectorAll('[data-recharts="Line"][data-dasharray]');
    expect(dashedLines.length).toBe(0);
    // One <Line> per exercise (3), none dashed.
    const lines = container.querySelectorAll('[data-recharts="Line"]');
    expect(lines.length).toBe(3);
  });

  it("shows the below-threshold banner only when every slope is null", () => {
    render(
      <ProgressChart
        points={POINTS}
        exerciseBaselines={BASELINES}
        perExerciseTrends={[
          { exercise_id: "up", session_count: 2, slope_per_month: null, trendline: null },
          { exercise_id: "flat", session_count: 1, slope_per_month: null, trendline: null },
          { exercise_id: "thin", session_count: 2, slope_per_month: null, trendline: null },
        ]}
        muscleGroupsIncluded={["chest"]}
        exerciseColors={new Map()}
      />,
    );
    expect(screen.getByText(/at least 3 sessions needed per exercise/i)).toBeInTheDocument();
  });

  it("hides the below-threshold banner when at least one slope is non-null", () => {
    renderChart();
    expect(screen.queryByText(/at least 3 sessions needed per exercise/i)).toBeNull();
  });
});

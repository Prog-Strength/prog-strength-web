/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { WorkoutHRTrackpoint } from "@/lib/api";

// Recharts renders nothing useful in jsdom (no layout). Stub it to passthrough
// divs tagged with their component name + key props so we can assert the axis
// is bound to elapsed time and the HR line is present, without a real SVG.
vi.mock("recharts", () => {
  const stub = (name: string) =>
    function Stub(props: Record<string, unknown>) {
      return (
        <div
          data-recharts={name}
          data-datakey={typeof props.dataKey === "string" ? props.dataKey : undefined}
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

import { WorkoutHeartRateChart } from "./WorkoutHeartRateChart";

const withHR: WorkoutHRTrackpoint[] = [
  { sequence: 0, elapsed_seconds: 0, heart_rate_bpm: 100 },
  { sequence: 1, elapsed_seconds: 30, heart_rate_bpm: 140 },
  { sequence: 2, elapsed_seconds: 60, heart_rate_bpm: 170 },
];

describe("WorkoutHeartRateChart", () => {
  it("plots the HR line against an elapsed-time x-axis", () => {
    const { container } = render(<WorkoutHeartRateChart trackpoints={withHR} avgHr={137} />);
    // X-axis is bound to elapsed seconds ("t"), not distance.
    const xAxis = container.querySelector('[data-recharts="XAxis"]');
    expect(xAxis?.getAttribute("data-datakey")).toBe("t");
    // The HR line is present (mirrors the running chart's red stroke).
    const line = container.querySelector('[data-recharts="Line"]');
    expect(line).not.toBeNull();
    expect(line?.getAttribute("data-stroke")).toBe("#f87171");
    // The average reference line is drawn when avgHr is provided.
    expect(container.querySelector('[data-recharts="ReferenceLine"]')).not.toBeNull();
  });

  it("shows a placeholder when no point carries heart rate", () => {
    const noHR: WorkoutHRTrackpoint[] = [
      { sequence: 0, elapsed_seconds: 0, heart_rate_bpm: null },
      { sequence: 1, elapsed_seconds: 30, heart_rate_bpm: null },
    ];
    render(<WorkoutHeartRateChart trackpoints={noHR} />);
    expect(screen.getByText("No heart-rate data")).toBeInTheDocument();
  });
});

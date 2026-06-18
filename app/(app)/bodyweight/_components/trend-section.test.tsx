/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { BodyweightEntry, BodyweightGoal } from "@/lib/api";
import { TrendSection, TrendTooltip } from "./trend-section";

// Recharts renders poorly in jsdom (no layout). We only assert on our own
// DOM — the hero, legend, and caption strip render outside the SVG — so we
// stub recharts to passthrough <div>s that still mount the children.
vi.mock("recharts", () => {
  const Pass = (name: string) =>
    function Pass({ children }: { children?: React.ReactNode }) {
      return <div data-recharts={name}>{children}</div>;
    };
  const Leaf = (name: string) =>
    function Leaf(props: Record<string, unknown>) {
      return <div data-recharts={name} data-datakey={String(props.dataKey ?? "")} />;
    };
  return {
    ResponsiveContainer: Pass("ResponsiveContainer"),
    ComposedChart: Pass("ComposedChart"),
    Area: Leaf("Area"),
    Scatter: Leaf("Scatter"),
    Line: Leaf("Line"),
    ReferenceLine: Leaf("ReferenceLine"),
    CartesianGrid: Leaf("CartesianGrid"),
    XAxis: Leaf("XAxis"),
    YAxis: Leaf("YAxis"),
    Tooltip: Leaf("Tooltip"),
  };
});

let nextId = 0;
function entry(weight: number, measured_at: string, unit: "lb" | "kg" = "lb"): BodyweightEntry {
  return { id: `e${nextId++}`, weight, unit, measured_at, created_at: measured_at };
}

function downTrend(): BodyweightEntry[] {
  return [
    entry(200, "2026-06-01T08:00:00"),
    entry(199, "2026-06-04T08:00:00"),
    entry(197, "2026-06-08T08:00:00"),
    entry(195, "2026-06-12T08:00:00"),
    entry(193, "2026-06-15T08:00:00"),
  ];
}

function upTrend(): BodyweightEntry[] {
  return [
    entry(190, "2026-06-01T08:00:00"),
    entry(192, "2026-06-04T08:00:00"),
    entry(194, "2026-06-08T08:00:00"),
    entry(196, "2026-06-12T08:00:00"),
    entry(198, "2026-06-15T08:00:00"),
  ];
}

const GOAL: BodyweightGoal = {
  weight: 185,
  unit: "lb",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("TrendSection", () => {
  it("shows the TREND NOW overline and a down arrow for a down-trending fixture", () => {
    render(<TrendSection entries={downTrend()} displayUnit="lb" goal={GOAL} isMobile={false} />);
    expect(screen.getByText(/trend now/i)).toBeInTheDocument();
    expect(screen.getByText(/lb\/wk/i)).toHaveTextContent("↓");
  });

  it("shows an up arrow for an up-trending fixture", () => {
    render(<TrendSection entries={upTrend()} displayUnit="lb" goal={GOAL} isMobile={false} />);
    expect(screen.getByText(/lb\/wk/i)).toHaveTextContent("↑");
  });

  it("hides the rate pill when there is under a week of data", () => {
    const sparse = [entry(200, "2026-06-14T08:00:00"), entry(199, "2026-06-15T08:00:00")];
    render(<TrendSection entries={sparse} displayUnit="lb" goal={null} isMobile={false} />);
    expect(screen.queryByText(/lb\/wk/i)).not.toBeInTheDocument();
  });

  it("renders the caption strip labels", () => {
    render(<TrendSection entries={downTrend()} displayUnit="lb" goal={GOAL} isMobile={false} />);
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Range Δ")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("To goal")).toBeInTheDocument();
  });

  it("omits the goal legend and To-goal caption when no goal is set", () => {
    render(<TrendSection entries={downTrend()} displayUnit="lb" goal={null} isMobile={false} />);
    expect(screen.queryByText("To goal")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Goal /)).not.toBeInTheDocument();
  });

  it("renders the empty state without a chart", () => {
    render(<TrendSection entries={[]} displayUnit="lb" goal={null} isMobile={false} />);
    expect(screen.getByText(/no readings in this range/i)).toBeInTheDocument();
    expect(screen.queryByText(/trend now/i)).not.toBeInTheDocument();
  });

  it("renders a single reading without breaking and hides the rate", () => {
    render(
      <TrendSection
        entries={[entry(184, "2026-06-15T08:00:00")]}
        displayUnit="lb"
        goal={null}
        isMobile={false}
      />,
    );
    expect(screen.getByText(/trend now/i)).toBeInTheDocument();
    expect(screen.queryByText(/lb\/wk/i)).not.toBeInTheDocument();
  });
});

describe("TrendTooltip", () => {
  const payload = [
    { dataKey: "trend", value: 182.4 },
    { dataKey: "band", value: [180.1, 184.7] },
  ];

  it("formats the hovered value as a weight, never a raw timestamp", () => {
    render(<TrendTooltip active payload={payload} label={1780150948286} displayUnit="lb" />);
    expect(screen.getByText(/182\.4 lb/)).toBeInTheDocument();
    expect(screen.queryByText(/1780150948286/)).not.toBeInTheDocument();
  });

  it("contributes no row for the band series", () => {
    const { container } = render(
      <TrendTooltip active payload={payload} label={1780150948286} displayUnit="lb" />,
    );
    expect(container.textContent).not.toMatch(/180\.1/);
    expect(container.textContent).not.toMatch(/184\.7/);
  });

  it("renders nothing when inactive", () => {
    const { container } = render(
      <TrendTooltip active={false} payload={payload} label={1780150948286} displayUnit="lb" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

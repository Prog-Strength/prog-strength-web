/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { BloodPressureEntry } from "@/lib/api";
import { BpTrendCard, BpTooltip } from "./bp-trend-card";

// Recharts has no layout in jsdom. We stub it to passthrough <div>s that
// still mount children and echo the props we assert on (the reference-line
// `y` and the y-axis `domain`), mirroring trend-section.test.tsx.
vi.mock("recharts", () => {
  const Pass = (name: string) =>
    function Pass({ children }: { children?: React.ReactNode }) {
      return <div data-recharts={name}>{children}</div>;
    };
  const Leaf = (name: string) =>
    function Leaf(props: Record<string, unknown>) {
      return (
        <div
          data-recharts={name}
          data-datakey={String(props.dataKey ?? "")}
          data-y={props.y !== undefined ? String(props.y) : undefined}
        />
      );
    };
  return {
    ResponsiveContainer: Pass("ResponsiveContainer"),
    ComposedChart: Pass("ComposedChart"),
    Line: Leaf("Line"),
    ReferenceLine: Leaf("ReferenceLine"),
    ReferenceArea: Leaf("ReferenceArea"),
    XAxis: Leaf("XAxis"),
    YAxis: Leaf("YAxis"),
    Tooltip: Leaf("Tooltip"),
  };
});

const TZ = "America/New_York";

let nextId = 0;
function entry(
  systolic: number,
  diastolic: number,
  measured_at: string,
  pulse: number | null = null,
): BloodPressureEntry {
  const category =
    systolic >= 180 || diastolic >= 120
      ? "crisis"
      : systolic >= 140 || diastolic >= 90
        ? "stage_2"
        : systolic >= 130 || diastolic >= 80
          ? "stage_1"
          : systolic >= 120
            ? "elevated"
            : "normal";
  return {
    id: `e${nextId++}`,
    systolic,
    diastolic,
    pulse,
    category,
    measured_at,
    created_at: measured_at,
  };
}

// All readings sit far below the 130/80 guideline lines.
function lowReadings(): BloodPressureEntry[] {
  return [
    entry(110, 70, "2026-06-01T13:00:00Z"),
    entry(112, 71, "2026-06-03T13:00:00Z"),
    entry(109, 69, "2026-06-05T13:00:00Z"),
    entry(111, 72, "2026-06-08T13:00:00Z"),
  ];
}

describe("BpTrendCard", () => {
  it("renders a 130 reference line even when every reading is far below it", () => {
    render(<BpTrendCard entries={lowReadings()} timeZone={TZ} isMobile={false} />);
    const refLines = document.querySelectorAll('[data-recharts="ReferenceLine"]');
    const ys = Array.from(refLines).map((el) => el.getAttribute("data-y"));
    // The systolic guideline line at 130 is always drawn — the y-domain is
    // widened to include it — so it's visible regardless of the data range.
    expect(ys).toContain("130");
    expect(ys).toContain("80");
  });

  it("renders the four stat tiles", () => {
    render(<BpTrendCard entries={lowReadings()} timeZone={TZ} isMobile={false} />);
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getByText("In normal range")).toBeInTheDocument();
    expect(screen.getByText("Readings")).toBeInTheDocument();
  });

  it("renders the empty state without a chart", () => {
    render(<BpTrendCard entries={[]} timeZone={TZ} isMobile={false} />);
    expect(screen.getByText(/no readings in this range/i)).toBeInTheDocument();
    expect(document.querySelector('[data-recharts="ComposedChart"]')).toBeNull();
  });
});

describe("BpTooltip", () => {
  const point = {
    t: 1780150948286,
    systolic: 122,
    diastolic: 78,
    count: 2,
    category: "elevated" as const,
  };

  it("shows both numbers, the count, and the category", () => {
    render(<BpTooltip active payload={[{ payload: point }]} label={point.t} />);
    expect(screen.getByText(/122\/78 mmHg/)).toBeInTheDocument();
    expect(screen.getByText(/Elevated/)).toBeInTheDocument();
    expect(screen.getByText(/2 readings/)).toBeInTheDocument();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(
      <BpTooltip active={false} payload={[{ payload: point }]} label={point.t} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

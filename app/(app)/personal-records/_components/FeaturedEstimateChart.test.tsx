/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { FeaturedEstimateChart, type FeaturedPoint } from "./FeaturedEstimateChart";

// Recharts' ResponsiveContainer reports 0×0 in jsdom; force a fixed size so
// child series mount and labels render.
vi.mock("recharts", async (orig) => {
  const mod = await orig<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 240 }}>{children}</div>
    ),
  };
});

const series: FeaturedPoint[] = [
  { t: new Date("2026-01-04").getTime(), value: 305 },
  { t: new Date("2026-02-11").getTime(), value: 312 },
  { t: new Date("2026-04-01").getTime(), value: 320 },
];
const fmt = (v: number) => String(Math.round(v));

describe("FeaturedEstimateChart", () => {
  it("renders the dashed reference line label", () => {
    render(
      <FeaturedEstimateChart
        data={series}
        referenceValue={305}
        referenceLabel="logged PR 305 lb"
        formatY={fmt}
      />,
    );
    expect(screen.getByText("logged PR 305 lb")).toBeInTheDocument();
  });

  it("shows the lower-is-faster note only for running", () => {
    const { rerender } = render(
      <FeaturedEstimateChart data={series} referenceValue={305} referenceLabel="r" formatY={fmt} />,
    );
    expect(screen.queryByText("lower is faster")).toBeNull();
    rerender(
      <FeaturedEstimateChart
        data={series}
        referenceValue={305}
        referenceLabel="r"
        formatY={fmt}
        lowerIsFasterNote
      />,
    );
    expect(screen.getByText("lower is faster")).toBeInTheDocument();
  });

  it("renders the single-point state with the value and 'Not enough data yet'", () => {
    render(
      <FeaturedEstimateChart
        data={[series[0]]}
        referenceValue={305}
        referenceLabel="r"
        formatY={fmt}
      />,
    );
    expect(screen.getByText("305")).toBeInTheDocument();
    expect(screen.getByText("Not enough data yet")).toBeInTheDocument();
  });

  it("renders the pending skeleton", () => {
    const { container } = render(
      <FeaturedEstimateChart
        data={[]}
        referenceValue={0}
        referenceLabel="r"
        formatY={fmt}
        isPending
      />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("renders a band area layer when hasBand is set", () => {
    const band: FeaturedPoint[] = series.map((p) => ({
      ...p,
      lower: p.value - 5,
      upper: p.value + 5,
    }));
    const { container } = render(
      <FeaturedEstimateChart
        data={band}
        referenceValue={310}
        referenceLabel="r"
        formatY={fmt}
        hasBand
        lowerIsFasterNote
      />,
    );
    expect(container.querySelector(".recharts-area")).toBeTruthy();
  });
});

/// <reference types="vitest/globals" />
import { render } from "@testing-library/react";

vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-recharts="LineChart">{children}</div>
    ),
    Line: ({
      dataKey,
      connectNulls,
      stroke,
    }: {
      dataKey: string;
      connectNulls?: boolean;
      stroke?: string;
    }) => (
      <div
        data-recharts="Line"
        data-key={dataKey}
        data-connect-nulls={String(connectNulls)}
        data-stroke={stroke}
      />
    ),
    ReferenceArea: ({ y1, y2, fill }: { y1: number; y2: number; fill: string }) => (
      <div data-recharts="ReferenceArea" data-y1={y1} data-y2={y2} data-fill={fill} />
    ),
    ReferenceLine: ({ y, stroke }: { y: number; stroke: string }) => (
      <div data-recharts="ReferenceLine" data-y={y} data-stroke={stroke} />
    ),
    XAxis: () => <div data-recharts="XAxis" />,
    YAxis: ({ domain }: { domain?: unknown }) => (
      <div data-recharts="YAxis" data-domain={JSON.stringify(domain)} />
    ),
    CartesianGrid: () => <div data-recharts="CartesianGrid" />,
    Tooltip: () => <div data-recharts="Tooltip" />,
  };
});

import { RecoveryTrends } from "./recovery-trends";
import type { WhoopRecoveryDay } from "@/lib/api";

const rows: WhoopRecoveryDay[] = [
  { date: "2026-07-01", recovery_score: 40, resting_heart_rate: 60, hrv_rmssd_milli: 70 },
  { date: "2026-07-02", recovery_score: null, resting_heart_rate: null, hrv_rmssd_milli: null },
  { date: "2026-07-03", recovery_score: 80, resting_heart_rate: 50, hrv_rmssd_milli: 90 },
];

describe("RecoveryTrends", () => {
  it("renders three line panels, one per metric", () => {
    render(<RecoveryTrends rows={rows} />);
    const dataKeys = Array.from(document.querySelectorAll('[data-recharts="Line"]')).map((l) =>
      l.getAttribute("data-key"),
    );
    expect(dataKeys).toEqual(
      expect.arrayContaining(["recovery_score", "resting_heart_rate", "hrv_rmssd_milli"]),
    );
  });

  it("disables connectNulls on every line (null days are gaps)", () => {
    render(<RecoveryTrends rows={rows} />);
    const lines = document.querySelectorAll('[data-recharts="Line"]');
    for (const line of Array.from(lines)) {
      expect(line.getAttribute("data-connect-nulls")).toBe("false");
    }
  });

  it("draws three score band zones with the semantic fills", () => {
    render(<RecoveryTrends rows={rows} />);
    const areas = Array.from(document.querySelectorAll('[data-recharts="ReferenceArea"]'));
    const fills = areas.map((a) => a.getAttribute("data-fill"));
    expect(fills).toEqual(expect.arrayContaining(["#c79292", "#d6b87f", "#86b39f"]));
    const danger = areas.find((a) => a.getAttribute("data-fill") === "#c79292")!;
    expect(danger.getAttribute("data-y1")).toBe("0");
    expect(danger.getAttribute("data-y2")).toBe("33");
    const success = areas.find((a) => a.getAttribute("data-fill") === "#86b39f")!;
    expect(success.getAttribute("data-y1")).toBe("67");
    expect(success.getAttribute("data-y2")).toBe("100");
  });

  it("draws an average reference line for resting HR and HRV at the non-null mean", () => {
    render(<RecoveryTrends rows={rows} />);
    const refLines = Array.from(document.querySelectorAll('[data-recharts="ReferenceLine"]'));
    const ys = refLines.map((l) => Number(l.getAttribute("data-y")));
    // resting HR mean of [60, 50] = 55; HRV mean of [70, 90] = 80.
    expect(ys).toEqual(expect.arrayContaining([55, 80]));
  });
});

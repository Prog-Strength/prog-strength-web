import { describe, expect, it } from "vitest";
import {
  recoveryBand,
  recoveryBandColor,
  toChartRows,
  latestForToday,
  type RecoveryBand,
} from "./recovery";
import type { WhoopRecoveryDay } from "./api";

describe("recoveryBand", () => {
  it("maps success at >= 67, including the 67 boundary", () => {
    expect(recoveryBand(100)).toBe("success");
    expect(recoveryBand(67)).toBe("success");
  });
  it("maps warning across 34..66 inclusive", () => {
    expect(recoveryBand(66)).toBe("warning");
    expect(recoveryBand(34)).toBe("warning");
  });
  it("maps danger at <= 33, including the 33 boundary", () => {
    expect(recoveryBand(33)).toBe("danger");
    expect(recoveryBand(0)).toBe("danger");
  });
});

describe("recoveryBandColor", () => {
  it("returns the semantic token var for each band", () => {
    const colors: Record<RecoveryBand, string> = {
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",
    };
    expect(recoveryBandColor("success")).toBe(colors.success);
    expect(recoveryBandColor("warning")).toBe(colors.warning);
    expect(recoveryBandColor("danger")).toBe(colors.danger);
  });
});

describe("toChartRows", () => {
  const rows: WhoopRecoveryDay[] = [
    { date: "2026-07-02", recovery_score: 72, resting_heart_rate: 54, hrv_rmssd_milli: 88.4 },
    { date: "2026-07-01", recovery_score: null, resting_heart_rate: null, hrv_rmssd_milli: null },
  ];
  it("returns rows ascending by date with null metrics preserved as null (gaps, not zeros)", () => {
    const out = toChartRows(rows);
    expect(out.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(out[0]).toEqual({
      date: "2026-07-01",
      recovery_score: null,
      resting_heart_rate: null,
      hrv_rmssd_milli: null,
    });
    expect(out[1].recovery_score).toBe(72);
  });
  it("does not mutate the input array", () => {
    const copy = [...rows];
    toChartRows(rows);
    expect(rows).toEqual(copy);
  });
});

describe("latestForToday", () => {
  const rows: WhoopRecoveryDay[] = [
    { date: "2026-07-01", recovery_score: 60, resting_heart_rate: 55, hrv_rmssd_milli: 70 },
    { date: "2026-07-02", recovery_score: 72, resting_heart_rate: 54, hrv_rmssd_milli: 88 },
  ];
  it("returns today's row when a row matches today's date", () => {
    expect(latestForToday(rows, "2026-07-02")).toEqual(rows[1]);
  });
  it("returns null when no row matches today (never promotes yesterday)", () => {
    expect(latestForToday(rows, "2026-07-03")).toBeNull();
  });
  it("returns null for an empty list", () => {
    expect(latestForToday([], "2026-07-02")).toBeNull();
  });
});

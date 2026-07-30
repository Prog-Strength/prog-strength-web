import { describe, it, expect } from "vitest";
import {
  formatDistanceValue,
  formatElevationValue,
  formatPaceValue,
} from "@/lib/distance-unit-context";

// These cover the PURE formatters only — the conversion + rounding math
// that the context methods delegate to — so no React rendering is needed.
// Expected strings were computed against the exact constants
// (1609.344 m/mi, 1000 m/km) the helpers use.

describe("formatDistanceValue", () => {
  it("formats kilometers (meters / 1000) with one decimal", () => {
    expect(formatDistanceValue(5000, "km")).toBe("5.0");
    expect(formatDistanceValue(10000, "km")).toBe("10.0");
  });

  it("formats miles (meters / 1609.344) with one decimal", () => {
    expect(formatDistanceValue(1609.344, "mi")).toBe("1.0");
    // 5000 / 1609.344 = 3.1068... → rounds to 3.1
    expect(formatDistanceValue(5000, "mi")).toBe("3.1");
  });

  it("keeps a trailing .0 on whole values (fixed one decimal)", () => {
    expect(formatDistanceValue(3000, "km")).toBe("3.0");
  });

  it("rounds to the nearest tenth", () => {
    // 1234 / 1000 = 1.234 → 1.2
    expect(formatDistanceValue(1234, "km")).toBe("1.2");
    // 1250 / 1000 = 1.25 → 1.3 (toFixed rounds half up here)
    expect(formatDistanceValue(1280, "km")).toBe("1.3");
  });

  it("returns the em-dash for non-finite input", () => {
    expect(formatDistanceValue(Number.NaN, "km")).toBe("—");
    expect(formatDistanceValue(Number.POSITIVE_INFINITY, "mi")).toBe("—");
  });
});

describe("formatPaceValue", () => {
  it("formats km pace (sec/km) as m:ss directly", () => {
    expect(formatPaceValue(300, "km")).toBe("5:00");
    // 65 sec → 1:05 (verifies zero-padding of seconds)
    expect(formatPaceValue(65, "km")).toBe("1:05");
  });

  it("converts km pace to mi pace (× 1.609344) before formatting", () => {
    // 300 * 1.609344 = 482.8 → round 483s → 8:03
    expect(formatPaceValue(300, "mi")).toBe("8:03");
  });

  it("rounds seconds to the nearest whole second", () => {
    // 359 * 1 = 359s → 5:59
    expect(formatPaceValue(359, "km")).toBe("5:59");
  });

  it("guards non-positive and non-finite input with the em-dash", () => {
    expect(formatPaceValue(0, "km")).toBe("—");
    expect(formatPaceValue(-5, "km")).toBe("—");
    expect(formatPaceValue(Number.NaN, "mi")).toBe("—");
    expect(formatPaceValue(Number.POSITIVE_INFINITY, "km")).toBe("—");
  });
});

describe("formatElevationValue", () => {
  it("formats feet (meters × 3.28084, rounded) under the imperial unit", () => {
    // 500 * 3.28084 = 1640.42 → 1640
    expect(formatElevationValue(500, "mi")).toBe("1,640 ft");
    // 1 * 3.28084 = 3.28 → 3
    expect(formatElevationValue(1, "mi")).toBe("3 ft");
  });

  it("adds a thousands separator to large feet values", () => {
    // 1000 * 3.28084 = 3280.84 → 3281
    expect(formatElevationValue(1000, "mi")).toBe("3,281 ft");
  });

  it("formats whole meters under the metric unit", () => {
    expect(formatElevationValue(376.4, "km")).toBe("376 m");
    // 1234 → thousands separator
    expect(formatElevationValue(1234, "km")).toBe("1,234 m");
  });

  it("returns the em-dash for null", () => {
    expect(formatElevationValue(null, "mi")).toBe("—");
    expect(formatElevationValue(null, "km")).toBe("—");
  });

  it("returns the em-dash for non-finite input", () => {
    expect(formatElevationValue(Number.NaN, "km")).toBe("—");
    expect(formatElevationValue(Number.POSITIVE_INFINITY, "mi")).toBe("—");
  });
});

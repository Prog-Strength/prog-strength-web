/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { ProgressionAggregate } from "@/lib/api";
import { StatCards, progressTone, slopeTone, formatSlope } from "./StatCards";

describe("progressTone", () => {
  const cases: [number, number, string][] = [
    [0, 0, "neutral"], // nothing tracked
    [3, 6, "positive"], // 0.5 boundary → positive
    [5, 6, "positive"],
    [2, 6, "neutral"], // ~0.33, between thresholds
    [1, 6, "negative"], // ~0.166 ≤ 0.25
    [1, 4, "negative"], // 0.25 boundary → negative
    [2, 4, "positive"], // 0.5 boundary → positive
  ];
  it.each(cases)("progressTone(%i, %i) = %s", (p, t, expected) => {
    expect(progressTone(p, t)).toBe(expected);
  });
});

describe("slopeTone", () => {
  const cases: [number | null, string][] = [
    [null, "neutral"],
    [0, "neutral"],
    [0.5, "neutral"], // boundary, not > 0.5
    [0.51, "positive"],
    [-0.5, "neutral"], // boundary, not < -0.5
    [-0.51, "negative"],
    [2.0, "positive"],
    [-3.0, "negative"],
  ];
  it.each(cases)("slopeTone(%s) = %s", (s, expected) => {
    expect(slopeTone(s)).toBe(expected);
  });
});

describe("formatSlope", () => {
  it.each([
    [null, "—"],
    [0, "0.0%/mo"],
    [1.4, "+1.4%/mo"],
    [-1.4, "-1.4%/mo"],
    [2.1, "+2.1%/mo"],
  ] as [number | null, string][])("formatSlope(%s) = %s", (s, expected) => {
    expect(formatSlope(s)).toBe(expected);
  });
});

// Tone is conveyed by the value text's color class on the StatTile.
const POSITIVE_CLASS = "text-[#86efac]";
const NEGATIVE_CLASS = "text-[var(--danger)]";
const NEUTRAL_CLASS = "text-[var(--foreground)]";

describe("StatCards rendering", () => {
  it("renders positive tones under a progressing aggregate", () => {
    const aggregate: ProgressionAggregate = {
      lifts_tracked: 6,
      lifts_progressing: 4,
      median_slope_per_month: 1.4,
      min_sessions_threshold: 3,
    };
    render(<StatCards aggregate={aggregate} bestPoint={null} />);
    const progressing = screen.getByText("4 / 6");
    const slope = screen.getByText("+1.4%/mo");
    expect(progressing).toHaveClass(POSITIVE_CLASS);
    expect(slope).toHaveClass(POSITIVE_CLASS);
  });

  it("renders negative tones under a regressing aggregate", () => {
    const aggregate: ProgressionAggregate = {
      lifts_tracked: 6,
      lifts_progressing: 1,
      median_slope_per_month: -1.4,
      min_sessions_threshold: 3,
    };
    render(<StatCards aggregate={aggregate} bestPoint={null} />);
    expect(screen.getByText("1 / 6")).toHaveClass(NEGATIVE_CLASS);
    expect(screen.getByText("-1.4%/mo")).toHaveClass(NEGATIVE_CLASS);
  });

  it("renders neutral 0 / 0 and — under a null/all-zeros aggregate", () => {
    render(<StatCards aggregate={null} bestPoint={null} />);
    const progressing = screen.getByText("0 / 0");
    expect(progressing).toHaveClass(NEUTRAL_CLASS);
    // Both the slope tile and the best-session tile read "—" with neutral
    // tone when there's no data; assert all dashes are neutral.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
    for (const d of dashes) expect(d).toHaveClass(NEUTRAL_CLASS);
  });
});

/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";

import { buildStepsGoalBars, StepsGoalBars } from "./steps-goal-bars";

describe("buildStepsGoalBars — scaling", () => {
  it("scales bars linearly against max(goal, maxDay) × headroom, not min/max-normalized", () => {
    const m = buildStepsGoalBars([6000, 16000], 11000, 10000);
    const big = m.slots[6];
    const small = m.slots[5];
    expect(big.heightPct).toBeGreaterThan(small.heightPct);
    expect(big.heightPct).toBeCloseTo((16000 / 17600) * 100, 1);
    expect(small.heightPct).toBeCloseTo((6000 / 17600) * 100, 1);
    expect(big.heightPct - small.heightPct).toBeGreaterThan(40);
  });

  it("gives over-goal bars headroom to crest the goal line", () => {
    const m = buildStepsGoalBars([12000], 12000, 10000);
    expect(m.goalPct).not.toBeNull();
    expect(m.slots[6].heightPct).toBeGreaterThan(m.goalPct as number);
  });
});

describe("buildStepsGoalBars — seven-slot axis", () => {
  it("always returns seven slots, right-aligned with today last", () => {
    const m = buildStepsGoalBars([9000], 9000, 10000);
    expect(m.slots).toHaveLength(7);
    expect(m.slots.slice(0, 6).every((s) => s.steps === null)).toBe(true);
    expect(m.slots[6].steps).toBe(9000);
    expect(m.slots[6].isToday).toBe(true);
    expect(m.slots[0].tone).toBe("empty");
  });

  it("takes the last seven when given more than seven days", () => {
    const m = buildStepsGoalBars([1, 2, 3, 4, 5, 6, 7, 8], 5, 10);
    expect(m.slots).toHaveLength(7);
    expect(m.slots[0].steps).toBe(2);
    expect(m.slots[6].steps).toBe(8);
  });
});

describe("buildStepsGoalBars — goal state coloring", () => {
  it("colors over-goal success, under-goal muted, today accent", () => {
    const m = buildStepsGoalBars([8000, 9000, 12000, 11500], 10125, 10000);
    expect(m.hasGoal).toBe(true);
    expect(m.goalPct).not.toBeNull();
    expect(m.slots[3].tone).toBe("muted");
    expect(m.slots[4].tone).toBe("muted");
    expect(m.slots[5].tone).toBe("success");
    expect(m.slots[6].tone).toBe("accent");
  });

  it("keeps today the accent even when today is under goal", () => {
    const m = buildStepsGoalBars([12000, 4000], 8000, 10000);
    expect(m.slots[6].tone).toBe("accent");
    expect(m.slots[5].tone).toBe("success");
  });
});

describe("buildStepsGoalBars — no goal", () => {
  it("draws no goal line and falls back to neutral + accent-today", () => {
    const m = buildStepsGoalBars([8000, 9000, 12000, 11500], 10125, null);
    expect(m.hasGoal).toBe(false);
    expect(m.goalPct).toBeNull();
    expect(m.slots[3].tone).toBe("muted");
    expect(m.slots[5].tone).toBe("muted");
    expect(m.slots[6].tone).toBe("accent");
    expect(m.slots.every((s) => Number.isFinite(s.heightPct))).toBe(true);
  });
});

describe("buildStepsGoalBars — degraded states", () => {
  it("renders an all-zero week as a flat floor with no NaN and no divide-by-zero", () => {
    const m = buildStepsGoalBars([0, 0, 0, 0, 0, 0, 0], 0, 10000);
    expect(m.slots.every((s) => s.heightPct === 0)).toBe(true);
    expect(m.slots.every((s) => Number.isFinite(s.heightPct))).toBe(true);
    expect(m.goalPct).not.toBeNull();
    expect(Number.isFinite(m.goalPct as number)).toBe(true);
  });

  it("renders a logged 0 as an honest floor bar (0 height), not a mid-height artifact", () => {
    const m = buildStepsGoalBars([0, 16000], 8000, 10000);
    expect(m.slots[5].steps).toBe(0);
    expect(m.slots[5].heightPct).toBe(0);
    expect(m.slots[5].tone).toBe("muted");
    expect(m.slots[6].heightPct).toBeGreaterThan(0);
  });

  it("handles an empty spark without NaN or a broken frame", () => {
    const m = buildStepsGoalBars([], 0, 10000);
    expect(m.slots).toHaveLength(7);
    expect(m.slots.every((s) => s.tone === "empty" && s.heightPct === 0)).toBe(true);
  });

  it("omits the goal line when goal is null or non-positive", () => {
    expect(buildStepsGoalBars([9000], 9000, null).goalPct).toBeNull();
    expect(buildStepsGoalBars([9000], 9000, 0).goalPct).toBeNull();
  });

  it("positions the average line and omits it only when unresolvable", () => {
    const m = buildStepsGoalBars([8000, 12000], 10000, 10000);
    expect(m.avgPct).not.toBeNull();
    expect(m.avgPct as number).toBeCloseTo((10000 / 13200) * 100, 1);
    expect(buildStepsGoalBars([0, 0], 0, null).avgPct).toBeNull();
  });
});

describe("StepsGoalBars — render", () => {
  it("renders seven bars, a goal line, and an average line when a goal is set", () => {
    render(<StepsGoalBars spark={[8000, 9000, 12000, 11500]} avg={10125} goal={10000} />);
    expect(screen.getAllByTestId("steps-bar")).toHaveLength(7);
    expect(screen.getByTestId("steps-goal-line")).toBeInTheDocument();
    expect(screen.getByTestId("steps-avg-line")).toBeInTheDocument();
  });

  it("tags each bar with its tone (today accent, over success, under muted)", () => {
    render(<StepsGoalBars spark={[8000, 9000, 12000, 11500]} avg={10125} goal={10000} />);
    const bars = screen.getAllByTestId("steps-bar");
    expect(bars[3]).toHaveAttribute("data-tone", "muted");
    expect(bars[5]).toHaveAttribute("data-tone", "success");
    expect(bars[6]).toHaveAttribute("data-tone", "accent");
  });

  it("draws no goal line and no over/under split when goal is null", () => {
    render(<StepsGoalBars spark={[8000, 9000, 12000, 11500]} avg={10125} goal={null} />);
    expect(screen.queryByTestId("steps-goal-line")).not.toBeInTheDocument();
    const bars = screen.getAllByTestId("steps-bar");
    expect(bars[5]).toHaveAttribute("data-tone", "muted");
    expect(bars[6]).toHaveAttribute("data-tone", "accent");
  });

  it("renders degraded fixtures without NaN in the DOM", () => {
    const { container: allZero } = render(
      <StepsGoalBars spark={[0, 0, 0, 0, 0, 0, 0]} avg={0} goal={10000} />,
    );
    expect(allZero.textContent).not.toMatch(/NaN/);
    const { container: single } = render(<StepsGoalBars spark={[9000]} avg={9000} goal={10000} />);
    expect(single.querySelectorAll('[data-testid="steps-bar"]')).toHaveLength(7);
    expect(single.textContent).not.toMatch(/NaN/);
  });
});

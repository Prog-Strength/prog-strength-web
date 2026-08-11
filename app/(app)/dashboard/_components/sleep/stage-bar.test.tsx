/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { StageBar } from "./stage-bar";
import { emptyNight, noStagesNight, scoredNight } from "./fixtures";
import { STAGE_ORDER, stageColor } from "./shared";

/** The rendered segments, in DOM order. */
function segments(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-stage]"));
}

function widthPct(el: HTMLElement): number {
  return parseFloat(el.style.width);
}

/**
 * The scored fixture's stage minutes: 1h 32m deep, 3h 55m light, 1h 56m REM,
 * 42m awake — 92, 235, 116 and 42 of 485 minutes. The percentages below are
 * LITERALS computed from those numbers by hand, deliberately not recomputed
 * from the fixture: a test that reruns the component's own formula compares it
 * to itself, and would keep passing if the proportion base moved off "stages
 * present" to `inBedMilli` — blessing the phantom gap the component forbids.
 */
const SCORED_PCT = {
  slowWave: 18.9691, // 92 / 485
  light: 48.4536, // 235 / 485
  rem: 23.9175, // 116 / 485
  awake: 8.6598, // 42 / 485
};

describe("StageBar", () => {
  it("stacks one segment per stage, deepest first", () => {
    const { container } = render(<StageBar night={scoredNight()} />);
    expect(segments(container).map((el) => el.dataset.stage)).toEqual([...STAGE_ORDER]);
  });

  it("segment widths are proportional to the night and sum to 100%", () => {
    const { container } = render(<StageBar night={scoredNight()} />);
    const els = segments(container);
    els.forEach((el, i) => {
      expect(widthPct(el)).toBeCloseTo(SCORED_PCT[STAGE_ORDER[i]], 3);
    });
    expect(els.reduce((sum, el) => sum + widthPct(el), 0)).toBeCloseTo(100, 5);
  });

  it("paints each segment with its ramp token, never a hex", () => {
    const { container } = render(<StageBar night={scoredNight()} />);
    segments(container).forEach((el, i) => {
      expect(el.style.backgroundColor).toBe(stageColor(STAGE_ORDER[i]));
      expect(el.style.backgroundColor).not.toContain("#");
    });
  });

  it("summarises all four durations on the track, in one accessible label", () => {
    // The trend-rail idiom: one `role="img"` with a summary on the container,
    // plain spans for the marks. The durations stay readable to a screen
    // reader without four segments announcing themselves separately.
    const { container } = render(<StageBar night={scoredNight()} />);
    expect(
      screen.getByRole("img", {
        name: "Sleep stages: Deep 1h 32m, Light 3h 55m, REM 1h 56m, Awake 42m",
      }),
    ).toBe(container.firstElementChild);
  });

  it("carries each stage's duration on hover, and spends no tab stop on it", () => {
    const { container } = render(<StageBar night={scoredNight()} />);
    const els = segments(container);
    expect(els.map((el) => el.getAttribute("title"))).toEqual([
      "Deep 1h 32m",
      "Light 3h 55m",
      "REM 1h 56m",
      "Awake 42m",
    ]);
    // The whole tile is one link: a focusable segment is a tab stop where
    // Enter does nothing, four times per tile.
    for (const el of els) {
      expect(el).not.toHaveAttribute("tabindex");
      expect(el).not.toHaveAttribute("role");
    }
  });

  it("a zero-duration stage renders no segment at all", () => {
    // Not a zero-width sliver carrying a tooltip nobody can hover.
    const { container } = render(<StageBar night={scoredNight({ awakeMilli: 0 })} />);
    expect(segments(container).map((el) => el.dataset.stage)).toEqual(["slowWave", "light", "rem"]);
    expect(segments(container).reduce((sum, el) => sum + widthPct(el), 0)).toBeCloseTo(100, 5);
  });

  it("a missing stage renders no segment and does not distort the others", () => {
    const { container } = render(<StageBar night={scoredNight({ remSleepMilli: null })} />);
    const els = segments(container);
    expect(els).toHaveLength(3);
    // Literals again, over the 92 + 235 + 42 = 369 minutes the night still
    // has. Proportions are taken over the STAGES PRESENT, so the three widths
    // fill the track — a base of `inBedMilli` would leave a phantom gap
    // standing in for a field Whoop never sent.
    expect(widthPct(els[0])).toBeCloseTo(24.9322, 3); // 92 / 369
    expect(widthPct(els[1])).toBeCloseTo(63.6856, 3); // 235 / 369
    expect(widthPct(els[2])).toBeCloseTo(11.3821, 3); // 42 / 369
    expect(els.reduce((sum, el) => sum + widthPct(el), 0)).toBeCloseTo(100, 5);
  });

  it("a night with no stage data gets the bar's own empty treatment, not four NaN widths", () => {
    const { container } = render(<StageBar night={noStagesNight()} />);
    expect(segments(container)).toHaveLength(0);
    expect(screen.getByRole("img", { name: /no sleep stages/i })).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("an entirely empty night is the empty treatment too", () => {
    const { container } = render(<StageBar night={emptyNight("2026-08-11")} />);
    expect(segments(container)).toHaveLength(0);
    expect(container.innerHTML).not.toContain("NaN");
  });
});

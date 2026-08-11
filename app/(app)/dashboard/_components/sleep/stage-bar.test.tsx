/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { StageBar } from "./stage-bar";
import { emptyNight, noStagesNight, scoredNight } from "./fixtures";
import { STAGE_ORDER, formatSleepDuration, stageColor, stageMilli } from "./shared";

/** The rendered segments, in DOM order. */
function segments(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-stage]"));
}

function widthPct(el: HTMLElement): number {
  return parseFloat(el.style.width);
}

describe("StageBar", () => {
  it("stacks one segment per stage, deepest first", () => {
    const { container } = render(<StageBar night={scoredNight()} />);
    expect(segments(container).map((el) => el.dataset.stage)).toEqual([...STAGE_ORDER]);
  });

  it("segment widths are proportional to the night and sum to 100%", () => {
    const night = scoredNight();
    const { container } = render(<StageBar night={night} />);
    const els = segments(container);
    const total = STAGE_ORDER.reduce((sum, s) => sum + (stageMilli(night, s) ?? 0), 0);
    els.forEach((el, i) => {
      const ms = stageMilli(night, STAGE_ORDER[i]) as number;
      expect(widthPct(el)).toBeCloseTo((ms / total) * 100, 5);
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

  it("carries stage name and duration for hover and focus", () => {
    const night = scoredNight();
    const { container } = render(<StageBar night={night} />);
    const deep = segments(container)[0];
    const label = `Deep ${formatSleepDuration(night.slowWaveSleepMilli)}`;
    expect(deep).toHaveAttribute("title", label);
    expect(deep).toHaveAttribute("aria-label", label);
    // Reachable by keyboard, so the duration is not a mouse-only fact.
    expect(deep).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Deep 1h 32m")).toBeInTheDocument();
  });

  it("a zero-duration stage renders no segment at all", () => {
    // Not a zero-width sliver carrying a tooltip nobody can hover.
    const { container } = render(<StageBar night={scoredNight({ awakeMilli: 0 })} />);
    expect(segments(container).map((el) => el.dataset.stage)).toEqual(["slowWave", "light", "rem"]);
    expect(segments(container).reduce((sum, el) => sum + widthPct(el), 0)).toBeCloseTo(100, 5);
  });

  it("a missing stage renders no segment and does not distort the others", () => {
    const night = scoredNight({ remSleepMilli: null });
    const { container } = render(<StageBar night={night} />);
    const els = segments(container);
    expect(els).toHaveLength(3);
    const total =
      (night.slowWaveSleepMilli as number) +
      (night.lightSleepMilli as number) +
      (night.awakeMilli as number);
    expect(widthPct(els[0])).toBeCloseTo(((night.slowWaveSleepMilli as number) / total) * 100, 5);
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

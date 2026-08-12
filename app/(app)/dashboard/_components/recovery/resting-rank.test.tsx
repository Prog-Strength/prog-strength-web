import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecoveryView } from "@/lib/dashboard";
import { RestingRankCard } from "./resting-rank";
import {
  creepingUpView,
  flatMonthView,
  legacyView,
  noMorningsView,
  restingCalibratingView,
  restingHrView,
  restingNoReadingView,
  restingSparseView,
} from "./fixtures";

const HREF = "/recovery";

function draw(section: RecoveryView) {
  return render(<RestingRankCard section={section} href={HREF} />);
}

/** The card's whole text, whitespace-normalised so JSX line breaks don't bite. */
function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * The same, but joining each direct child's text with a space. `textContent`
 * concatenates adjacent spans with nothing between them, so a row rendering
 * `<span>Tue</span><span>50 bpm</span>` reads "Tue50 bpm" — which is a fact
 * about jsdom, not about the card, and asserting on it would be asserting on
 * the markup rather than on what the user reads.
 */
function parts(el: Element): string {
  return Array.from(el.childNodes)
    .map((n) => (n.textContent ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("RestingRankCard — default", () => {
  it("prints today's bpm as the hero, with its unit", () => {
    const { container } = draw(restingHrView());
    expect(parts(screen.getByTestId("rhr-hero"))).toBe("50 bpm");
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });

  // An ordinary morning is not an event. The whole colour budget stays unspent.
  it("spends no colour, and keeps the ordinal in --foreground", () => {
    const { container } = draw(restingHrView());
    expect(container.innerHTML).not.toContain("var(--warning)");
    expect(screen.getByTestId("rhr-rank-phrase")).toHaveStyle({
      color: "var(--foreground)",
    });
  });

  it("captions the rank against the honest count of mornings behind it", () => {
    draw(restingHrView());
    expect(text(screen.getByTestId("rhr-caption"))).toBe("4th lowest of your last 29");
  });

  it("prints the extremes at the ends of the strip", () => {
    draw(restingHrView());
    expect(text(screen.getByTestId("rhr-lowest-label"))).toBe("47 lowest");
    expect(text(screen.getByTestId("rhr-highest-label"))).toBe("59 highest");
  });

  it("draws the 30-day average as its own dashed tick, labelled", () => {
    draw(restingHrView());
    expect(screen.getByTestId("rhr-avg-tick")).toBeInTheDocument();
    expect(text(screen.getByTestId("rhr-avg-label"))).toBe("53 avg");
  });

  // The DX's float. A card that prints `49.6 bpm` has failed before it is
  // compared, and one that ranks it apart from the 50 beside it has too.
  it("renders 49.6 as 50 and never prints the float", () => {
    const { container } = draw(restingHrView());
    expect(text(container)).not.toContain("49.6");
    expect(parts(screen.getAllByTestId("rhr-recent-row")[1])).toBe("Tue 50 bpm");
  });

  // Adjacency, not preference: recovery_log prints the same three mornings
  // newest-first in the same register and may sit directly beside this tile.
  it("lists the recent mornings newest-first", () => {
    draw(restingHrView());
    const rows = screen.getAllByTestId("rhr-recent-row");
    expect(rows).toHaveLength(3);
    expect(parts(rows[0])).toBe("Today 50 bpm");
    expect(parts(rows[2])).toBe("Mon 47 bpm");
  });

  // POLARITY PIN. Reversing the sort to descending inverts the card's only
  // statement of "lower is better" while leaving both labels technically
  // correct — the quietest possible way to break this tile.
  it("draws the strip ascending, with `lowest` on the left", () => {
    const { container } = draw(restingHrView());
    const ticks = Array.from(container.querySelectorAll("[data-tick-value]"));
    const values = ticks.map((t) => Number(t.getAttribute("data-tick-value")));
    expect(values).toHaveLength(29);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(text(screen.getByTestId("rhr-lowest-label"))).toContain("lowest");
  });

  it("describes itself in one sentence for a screen reader", () => {
    draw(restingHrView());
    expect(screen.getByTestId("rhr-strip")).toHaveAttribute(
      "aria-label",
      "Today's resting heart rate of 50 bpm is the 4th lowest of your last 29 mornings, which ranged from 47 to 59 bpm, against a 30-day average of 53.",
    );
  });
});

describe("RestingRankCard — creeping-up", () => {
  it("ranks today at the top of its own month and colours it", () => {
    draw(creepingUpView());
    expect(text(screen.getByTestId("rhr-caption"))).toBe("30th lowest of your last 30");
    expect(screen.getByTestId("rhr-tick-today")).toHaveStyle({
      backgroundColor: "var(--warning)",
    });
    expect(screen.getByTestId("rhr-rank-phrase")).toHaveStyle({ color: "var(--warning)" });
  });

  it("puts today's value at the high end of the strip", () => {
    draw(creepingUpView());
    expect(text(screen.getByTestId("rhr-highest-label"))).toBe("58 highest");
  });

  // A rank alone cannot say "and it has been climbing". The rows can.
  it("shows the climb in the recent rows", () => {
    draw(creepingUpView());
    const rows = screen.getAllByTestId("rhr-recent-row").map(parts);
    expect(rows).toEqual(["Today 58 bpm", "Tue 57 bpm", "Mon 56 bpm"]);
  });
});

describe("RestingRankCard — the colour gate", () => {
  /**
   * CORRECTION 2, and the regression test for it. Today is 55 against a 53.4
   * average — above it, and warm under the SOW's contract — but ranks 19th of
   * 29, which is BELOW the mockup's `rank > (n * 2) / 3` upper-third boundary
   * of 19.33. This test must FAIL against the mockup's rule.
   *
   * The reason the contract wins: the card DRAWS the average tick. Under the
   * upper-third rule today's tick sits visibly right of the dashed average tick
   * and is still painted neutral ink — the card contradicting its own graphic.
   */
  function aboveAverageButMidStrip(): RecoveryView {
    const base = restingHrView();
    const days = [...base.days!];
    days[days.length - 1] = { ...days[days.length - 1], restingHr: 55 };
    return { ...base, days, restingToday: 55 };
  }

  it("colours a morning above the average even when it is not in the upper third", () => {
    draw(aboveAverageButMidStrip());
    expect(text(screen.getByTestId("rhr-caption"))).toBe("19th lowest of your last 29");
    expect(screen.getByTestId("rhr-tick-today")).toHaveStyle({
      backgroundColor: "var(--warning)",
    });
  });

  // isAbove is defined on the PRINTED delta: a difference the card does not
  // print is a difference the card does not colour.
  it("spends no colour when today is exactly the average", () => {
    const { container } = draw(flatMonthView());
    expect(container.innerHTML).not.toContain("var(--warning)");
  });
});

describe("RestingRankCard — flat-month", () => {
  // The variant's structural advantage: no axis to auto-scale, so two beats of
  // range read as "nothing is happening" rather than as a mountain range.
  it("states the whole month's range in two labels", () => {
    draw(flatMonthView());
    expect(text(screen.getByTestId("rhr-lowest-label"))).toBe("48 lowest");
    expect(text(screen.getByTestId("rhr-highest-label"))).toBe("50 highest");
  });
});

describe("RestingRankCard — no reading yet today", () => {
  it("prints an em-dash hero and says so, rather than promoting yesterday", () => {
    draw(restingNoReadingView());
    expect(parts(screen.getByTestId("rhr-hero"))).toBe("— bpm");
    expect(text(screen.getByTestId("rhr-caption"))).toBe("No reading yet today");
    expect(screen.queryByTestId("rhr-tick-today")).toBeNull();
  });

  it("keeps the strip and its average tick drawn from the remaining mornings", () => {
    draw(restingNoReadingView());
    expect(screen.getAllByTestId("rhr-tick")).toHaveLength(28);
    expect(screen.getByTestId("rhr-avg-tick")).toBeInTheDocument();
  });

  it("prints yesterday's value only in the recent-rows register", () => {
    const { container } = draw(restingNoReadingView());
    expect(parts(screen.getAllByTestId("rhr-recent-row")[1])).toBe("Tue 50 bpm");
    for (const row of screen.getAllByTestId("rhr-recent-row")) row.remove();
    expect(text(container)).not.toContain("50");
  });
});

describe("RestingRankCard — sparse", () => {
  it("reports the true number of mornings behind the rank", () => {
    draw(restingSparseView());
    expect(text(screen.getByTestId("rhr-caption"))).toBe("4th lowest of your last 24");
  });

  it("reads a strap-off morning as a gap, in words", () => {
    draw(restingSparseView());
    const rows = screen.getAllByTestId("rhr-recent-row").map(parts);
    expect(rows).toEqual(["Today 50 bpm", "Tue no reading", "Mon no reading"]);
  });
});

describe("RestingRankCard — calibrating", () => {
  // The state this variant was partly selected on: a rank needs no baseline,
  // only a distribution, so the main graphic survives intact.
  it("still draws the strip", () => {
    draw(restingCalibratingView());
    expect(screen.getAllByTestId("rhr-tick").length).toBeGreaterThan(0);
    expect(text(screen.getByTestId("rhr-caption"))).toContain("2nd lowest of your last 10");
  });

  it("draws no average tick, no average label, and no colour", () => {
    const { container } = draw(restingCalibratingView());
    expect(screen.queryByTestId("rhr-avg-tick")).toBeNull();
    expect(screen.queryByTestId("rhr-avg-label")).toBeNull();
    expect(container.innerHTML).not.toContain("var(--warning)");
  });

  // Gated on restingHrDays, never hrvDays — a different sample with a
  // different size.
  it("reports its own metric's progress toward a baseline", () => {
    draw(restingCalibratingView());
    expect(text(screen.getByTestId("rhr-caption"))).toContain("no avg yet, 9 of 14 mornings");
  });

  // jsdom has no layout, so the reserved class IS the assertion.
  it("reserves the caption's second line so the card cannot change height", () => {
    const { unmount } = draw(restingCalibratingView());
    const calibrating = screen.getByTestId("rhr-caption").className;
    unmount();
    draw(restingHrView());
    expect(screen.getByTestId("rhr-caption").className).toBe(calibrating);
    expect(calibrating).toContain("min-h-[28px]");
  });
});

describe("RestingRankCard — degenerate payloads", () => {
  it("renders a muted line, not a zero-width strip, when no morning has a reading", () => {
    const { container } = draw(noMorningsView());
    expect(screen.queryByTestId("rhr-strip")).toBeNull();
    expect(text(container)).toContain("No resting heart rate readings yet");
  });

  it("renders the calibrating body for a legacy payload with no days or baseline", () => {
    const { container } = draw(legacyView());
    expect(screen.queryByTestId("rhr-strip")).toBeNull();
    expect(text(container)).toContain("Resting HR is calibrating");
  });
});

describe("RestingRankCard — the design system", () => {
  // --accent carries `elevated` HRV elsewhere in this family; --danger is
  // licensed for one thing only (a sub-33 Whoop score); and a low morning is
  // never painted green, because most mornings are ordinary.
  it.each([
    ["restingHrView", restingHrView],
    ["creepingUpView", creepingUpView],
    ["flatMonthView", flatMonthView],
    ["restingNoReadingView", restingNoReadingView],
    ["restingSparseView", restingSparseView],
    ["restingCalibratingView", restingCalibratingView],
  ])("spends no accent, danger, or success on %s", (_name, build) => {
    const { container } = draw(build());
    expect(container.innerHTML).not.toContain("var(--accent)");
    expect(container.innerHTML).not.toContain("var(--danger)");
    expect(container.innerHTML).not.toContain("var(--success)");
  });
});

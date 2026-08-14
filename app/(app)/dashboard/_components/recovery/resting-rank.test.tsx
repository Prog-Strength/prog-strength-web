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
 * A line read as its FIELDS in DOM order, following `morning-ledger.test.tsx`'s
 * `fields`. `textContent` runs the parts together (`Tue50 bpm`) because the gap
 * between them is flex, not text, and an ARRAY is the stronger assertion
 * anyway: a flattened string cannot tell one element reading `Today 50 bpm`
 * from a label and a figure in two, so only the array pins each row's reading
 * order.
 *
 * Over `childNodes` rather than `children`, unlike the sibling: this card's
 * hero is a bare text node (`50`) beside its unit span, and element children
 * alone would drop the very figure under test.
 */
function fields(el: Element): string[] {
  return Array.from(el.childNodes)
    .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe("RestingRankCard — default", () => {
  it("prints today's bpm as the hero, with its unit", () => {
    const { container } = draw(restingHrView());
    expect(fields(screen.getByTestId("rhr-hero"))).toEqual(["50", "bpm"]);
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
    expect(fields(screen.getAllByTestId("rhr-recent-row")[1])).toEqual(["Tue", "50 bpm"]);
  });

  // Adjacency, not preference: recovery_log prints the same register
  // newest-first and may sit directly beside this tile. It shows five; this
  // card stops at four because it is the tallest on the grid — see RECENT_ROWS.
  it("lists the recent mornings newest-first", () => {
    draw(restingHrView());
    const rows = screen.getAllByTestId("rhr-recent-row");
    expect(rows).toHaveLength(4);
    expect(fields(rows[0])).toEqual(["Today", "50 bpm"]);
    expect(fields(rows[2])).toEqual(["Mon", "47 bpm"]);
    // Sunday's 59 — the DX's bump — now sits inside the register rather than
    // one row past its bottom edge, which is the point of the deeper window.
    expect(fields(rows[3])).toEqual(["Sun", "59 bpm"]);
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
    const rows = screen.getAllByTestId("rhr-recent-row").map(fields);
    // The fourth row reaches back to 54, the climb's first step, so the
    // register shows where the rise started and not only that it is high.
    expect(rows).toEqual([
      ["Today", "58 bpm"],
      ["Tue", "57 bpm"],
      ["Mon", "56 bpm"],
      ["Sun", "54 bpm"],
    ]);
  });
});

describe("RestingRankCard — today's label over its tick", () => {
  // The hero repeated at 9px over today's own tick, and the component's only
  // consumer of `labelAnchor`.
  it("repeats today's rounded value, and says it only once to a screen reader", () => {
    draw(restingHrView());
    const label = screen.getByTestId("rhr-today-label");
    expect(text(label)).toBe("50");
    // A visual repeat of the hero two lines above, which the strip's own
    // sentence also states — read aloud it would be a bare "50" between them.
    expect(label).toHaveAttribute("aria-hidden", "true");
  });

  it("centres over its own tick mid-strip", () => {
    draw(restingHrView());
    // 4th of 29 is 12.07% along, comfortably inside both edges.
    expect(screen.getByTestId("rhr-today-label")).toHaveStyle({
      transform: "translateX(-50%)",
    });
  });

  // ANCHOR SWITCH, not a clamp: creeping-up's 30th of 30 sits at 98.3%, where a
  // centred label would hang off the panel. Clamping the position instead would
  // drag the figure away from the tick it names.
  it("anchors to the right edge when today is the highest morning", () => {
    draw(creepingUpView());
    expect(screen.getByTestId("rhr-today-label")).toHaveStyle({
      left: "100%",
      transform: "translateX(-100%)",
    });
  });

  it("is absent when there is no reading yet today", () => {
    draw(restingNoReadingView());
    expect(screen.queryByTestId("rhr-today-label")).toBeNull();
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

  // isAbove is defined on the ROUNDED departure, and here today IS the average:
  // a departure of zero is not a direction, so the card spends nothing on it.
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
    expect(fields(screen.getByTestId("rhr-hero"))).toEqual(["—", "bpm"]);
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
    expect(fields(screen.getAllByTestId("rhr-recent-row")[1])).toEqual(["Tue", "50 bpm"]);
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
    const rows = screen.getAllByTestId("rhr-recent-row").map(fields);
    expect(rows).toEqual([
      ["Today", "50 bpm"],
      ["Tue", "no reading"],
      ["Mon", "no reading"],
      ["Sun", "48 bpm"],
    ]);
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

  // jsdom has no layout, so the invariant is asserted structurally: the second
  // line is an ELEMENT that exists in every state, empty when it has nothing to
  // say. Making that `<p>` conditional is the defect this catches, and it is
  // the one that costs the calibrating card 13px of height the settled one has.
  it("reserves the caption's second line so the card cannot change height", () => {
    const { unmount } = draw(restingCalibratingView());
    const calibrating = screen.getByTestId("rhr-caption").querySelectorAll("p");
    expect(calibrating).toHaveLength(2);
    expect(text(calibrating[1])).toBe("no avg yet, 9 of 14 mornings");
    unmount();

    draw(restingHrView());
    const settled = screen.getByTestId("rhr-caption");
    const lines = settled.querySelectorAll("p");
    expect(lines).toHaveLength(2);
    expect(text(lines[1])).toBe("");
    // The class assertion earns its place separately: an empty block box is
    // zero-high on its own, so the floor is what turns the reserved element
    // into reserved SPACE.
    expect(settled.className).toContain("min-h-[28px]");
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

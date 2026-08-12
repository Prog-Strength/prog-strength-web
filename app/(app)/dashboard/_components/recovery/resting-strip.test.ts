import { describe, expect, it } from "vitest";
import type { RecoveryDayPoint } from "@/lib/dashboard";
import {
  AVG_LABEL_MAX_PCT,
  AVG_LABEL_MIN_PCT,
  avgInsertPct,
  endpointRow,
  labelAnchor,
  rankOf,
  sortedMornings,
  STRIP_WINDOW,
  tickPct,
} from "./resting-strip";

/** A minimal day series — this module reads `restingHr` and nothing else. */
function days(values: (number | null)[]): RecoveryDayPoint[] {
  return values.map((restingHr, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    restingHr,
    recoveryScore: null,
    hrv: null,
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown" as const,
  }));
}

describe("sortedMornings", () => {
  // CORRECTION 1, pinned in BOTH directions. The card displays with
  // `Math.round`, so any other rounding here desynchronises the strip's order
  // from the figures printed over it. 49.6 fails against the raw float and
  // against floor/trunc; 49.4 fails against the raw float and against ceil.
  // Together they admit only `Math.round`.
  it("rounds before sorting, so two mornings the card both prints as 50 sort as one value", () => {
    expect(sortedMornings(days([49.6, 50]), STRIP_WINDOW)).toEqual([50, 50]);
  });

  it("rounds down below the half, so a 49.4 sorts as the 49 the card prints", () => {
    expect(sortedMornings(days([49.4, 50]), STRIP_WINDOW)).toEqual([49, 50]);
  });

  it("sorts ascending", () => {
    expect(sortedMornings(days([59, 47, 53, 48]), STRIP_WINDOW)).toEqual([47, 48, 53, 59]);
  });

  it("drops nulls rather than zero-filling", () => {
    expect(sortedMornings(days([50, null, 48]), STRIP_WINDOW)).toEqual([48, 50]);
  });

  it("returns an empty array for an all-null window", () => {
    expect(sortedMornings(days([null, null, null]), STRIP_WINDOW)).toEqual([]);
  });

  it("takes only the last `window` mornings", () => {
    // 31 entries in, 30 out — the oldest is excluded, as the payload's own
    // 31-day window means `days` carries one more than the strip draws.
    const thirtyOne = Array.from({ length: 31 }, (_, i) => 40 + i);
    const got = sortedMornings(days(thirtyOne), STRIP_WINDOW);
    expect(got).toHaveLength(30);
    expect(got[0]).toBe(41);
  });
});

describe("rankOf", () => {
  it("is 1-based from the lowest", () => {
    expect(rankOf([47, 48, 49, 50], 47)).toBe(1);
    expect(rankOf([47, 48, 49, 50], 50)).toBe(4);
  });

  // Ties share the LOWER rank — two identical 48s are both "1st lowest" rather
  // than arbitrarily ordered.
  it("gives tied values the same rank", () => {
    expect(rankOf([47, 48, 48, 48, 50], 48)).toBe(2);
  });

  it("ranks a float exactly as its printed integer does", () => {
    expect(rankOf([47, 50, 50, 59], 49.6)).toBe(rankOf([47, 50, 50, 59], 50));
    expect(rankOf([47, 50, 50, 59], 49.6)).toBe(2);
  });

  // The two directions of the rounding, over a strip holding the integer BELOW
  // the float — the shape the case above cannot have, since no integer lies
  // between 49.6 and 50. Between them they admit only `Math.round`, which is
  // the rounding the card displays with:
  //
  //   49.4 kills `Math.ceil` and no rounding at all (both rank it 4th, so the
  //   card would print `49` and caption it `4th lowest` past two 49s);
  //   49.6 kills `Math.floor` and `Math.trunc` (both rank it 2nd, so the card
  //   would print `50` and caption it `2nd lowest` ahead of two 49s).
  it("ranks a float that rounds down where its printed integer ranks", () => {
    expect(rankOf([47, 49, 49, 59], 49.4)).toBe(rankOf([47, 49, 49, 59], 49));
    expect(rankOf([47, 49, 49, 59], 49.4)).toBe(2);
  });

  it("ranks a float that rounds up above the values it passed", () => {
    expect(rankOf([47, 49, 49, 59], 49.6)).toBe(4);
  });

  it("is null when there is no reading yet today", () => {
    expect(rankOf([47, 48, 49], null)).toBeNull();
  });
});

describe("tickPct", () => {
  it("centres each tick in its own share of the strip", () => {
    expect(tickPct(0, 4)).toBe(12.5);
    expect(tickPct(3, 4)).toBe(87.5);
  });
});

describe("avgInsertPct", () => {
  // The average is NOT one of the athlete's mornings, so it sits at the
  // BOUNDARY between two ticks — never at a tick centre.
  it("places the average at the boundary between two ticks", () => {
    expect(avgInsertPct([47, 48, 49, 50], 48.5)).toBe(50);
  });

  it("computes against the raw average, not a rounded one", () => {
    // 53.4 genuinely sits above every 53: the tick is a position, not a value.
    expect(avgInsertPct([53, 53, 54, 54], 53.4)).toBe(50);
  });

  // The tie case, which is the one that SHIPS: `creepingUpView` and
  // `flatMonthView` both average exactly 49 over a strip containing 49s. The
  // comparison is strictly `<`, so the dash lands at the START of the run — a
  // `<=` here would move creeping-up's average tick from 53.3% to 76.7% and
  // silently drop its `highest` label, with every other test still green.
  it("places an average equal to a run of values at the start of that run", () => {
    expect(avgInsertPct([48, 49, 49, 50], 49)).toBe(25);
  });

  it("is null when there is no average yet", () => {
    expect(avgInsertPct([47, 48], null)).toBeNull();
  });

  // An empty strip is a shipped shape (`noMorningsView` is 31 nulls), and the
  // average comes from a DIFFERENT window than the strip, so the caller may not
  // assume an empty strip implies a null average. Getting it wrong fails
  // invisibly: a NaN percentage reaches the DOM as `left: "NaN%"`, which the
  // CSSOM drops silently, leaving a plausible card with the dash in the wrong
  // place.
  it("is null for an empty strip rather than dividing by zero", () => {
    expect(avgInsertPct([], 49)).toBeNull();
  });
});

describe("labelAnchor", () => {
  it("anchors left near the low end so the label stays on the card", () => {
    expect(labelAnchor(1.7)).toEqual({ left: "0%", transform: "none" });
  });

  it("anchors right near the high end", () => {
    expect(labelAnchor(98.3)).toEqual({ left: "100%", transform: "translateX(-100%)" });
  });

  it("centres the label over its tick everywhere between", () => {
    expect(labelAnchor(50)).toEqual({ left: "50%", transform: "translateX(-50%)" });
  });
});

describe("endpointRow", () => {
  it("shows both endpoint labels when there is no average to conflict with", () => {
    expect(endpointRow(null)).toEqual({
      avgLabelPct: null,
      showLowest: true,
      showHighest: true,
    });
  });

  it("suppresses neither endpoint when the average sits mid-strip", () => {
    expect(endpointRow(50)).toEqual({ avgLabelPct: 50, showLowest: true, showHighest: true });
  });

  it("clamps the avg LABEL to the card, leaving the caller's tick at its true position", () => {
    expect(endpointRow(2).avgLabelPct).toBe(AVG_LABEL_MIN_PCT);
    expect(endpointRow(97).avgLabelPct).toBe(AVG_LABEL_MAX_PCT);
  });

  // The avg label wins against the endpoints: it is the more informative
  // figure, and the extremes stay visible as the outermost ticks regardless.
  it("drops the lowest label when the avg label crowds it", () => {
    expect(endpointRow(20).showLowest).toBe(false);
    expect(endpointRow(20).showHighest).toBe(true);
  });

  it("drops the highest label when the avg label crowds it", () => {
    expect(endpointRow(90).showHighest).toBe(false);
    expect(endpointRow(90).showLowest).toBe(true);
  });

  it("keeps both at the clearance boundaries", () => {
    expect(endpointRow(34).showLowest).toBe(true);
    expect(endpointRow(66).showHighest).toBe(true);
  });
});

describe("the polarity pin", () => {
  // Reversing the sort to descending would invert the card's ONLY statement of
  // polarity while leaving both endpoint labels technically correct — the
  // quietest possible way to break this tile. Pinned here and again in the DOM.
  it("sorts so that index 0 is the lowest", () => {
    const sorted = sortedMornings(days([59, 47, 53, 48]), STRIP_WINDOW);
    expect(sorted[0]).toBeLessThanOrEqual(sorted[sorted.length - 1]);
    expect(sorted[0]).toBe(47);
  });
});

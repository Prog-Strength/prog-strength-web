/**
 * Pins the invariant these fixtures advertise and the shape of the window they
 * build — the same remit `recovery/fixtures.test.ts` has.
 *
 * THE INVARIANT: on a fully-staged night, deep + light + REM + awake sums
 * EXACTLY to `inBedMilli`. Server-side that is structural — the stage summary
 * is a partition of time in bed, not four numbers standing beside it — so a
 * fixture where they disagree describes a payload the API cannot emit. The
 * stacked bar takes its proportions from those stages, so such a fixture would
 * draw a perfectly plausible bar asserting an impossible night rather than
 * failing loudly. Nights that are deliberately INCOMPLETE (`partialNight`, the
 * window's interior gap) are exempt: a missing stage is a missing field, not a
 * broken partition, so the invariant is asserted over the nights that carry all
 * four and the count of those is asserted too, so the loop cannot go vacuous.
 *
 * THE WINDOW is the second remit. `SleepView.nights` is the date-aligned
 * trailing window the payload contract requires — every date present, missing
 * nights carrying null metrics, never omitted and never zero-filled — and no
 * component reads it today, so this file is what keeps the fixture honest about
 * a contract the tile will be built against tomorrow.
 */

import { describe, expect, it } from "vitest";
import type { SleepNightView } from "@/lib/dashboard";
import { STAGE_ORDER, stageMilli } from "./shared";
import {
  FIXTURE_GAP_INDEX,
  FIXTURE_TODAY,
  emptyNight,
  nightsWindow,
  noDataView,
  partialNightView,
  scoredNight,
  scoredNightView,
} from "./fixtures";

/** The four stages summed, or null when the night is missing any of them. */
function stageSum(night: SleepNightView): number | null {
  const parts = STAGE_ORDER.map((stage) => stageMilli(night, stage));
  if (parts.some((p) => p === null)) return null;
  return parts.reduce((sum: number, p) => sum + (p as number), 0);
}

const VIEWS = [
  ["scoredNightView", scoredNightView],
  ["partialNightView", partialNightView],
  ["noDataView", noDataView],
] as const;

describe("the stages partition time in bed", () => {
  it("holds for the headline scored night", () => {
    const night = scoredNight();
    expect(stageSum(night)).toBe(night.inBedMilli);
  });

  it("survives an override of time in bed — the stages scale with it", () => {
    // The bug: overriding `inBedMilli` alone left a night claiming 7h 30m in
    // bed while its stages still summed to 8h 05m.
    const window = nightsWindow(scoredNight());
    const staged = window.filter((n) => stageSum(n) !== null);
    expect(staged.length).toBe(window.length - 1); // every night but the gap
    for (const night of staged) expect(stageSum(night)).toBe(night.inBedMilli);
  });

  it.each(VIEWS)("holds for every fully-staged night of %s", (_name, build) => {
    for (const night of build().nights) {
      const sum = stageSum(night);
      if (sum === null) continue; // deliberately incomplete, not broken
      expect(sum).toBe(night.inBedMilli);
    }
  });
});

describe("the nights window", () => {
  it.each(VIEWS)("%s is date-aligned, ascending, and ends on the fixture today", (_name, build) => {
    const dates = build().nights.map((n) => n.date);
    expect(dates).toHaveLength(7);
    expect(dates.at(-1)).toBe(FIXTURE_TODAY);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("carries the interior gap as an all-null night, never zero-filled", () => {
    const gap = scoredNightView().nights[FIXTURE_GAP_INDEX];
    // A night with no data and a night of zero sleep are different facts.
    expect(gap).toEqual(emptyNight(gap.date));
    expect(gap.inBedMilli).toBeNull();
    expect(gap.performancePct).toBeNull();
  });

  it("ends on the very night the view heroes", () => {
    const view = scoredNightView();
    expect(view.nights.at(-1)).toEqual({ ...view.lastNight, date: FIXTURE_TODAY });
  });

  it("varies the interior nights so a series reader sees more than one row", () => {
    const interior = nightsWindow(scoredNight())
      .slice(0, -1)
      .filter((n) => n.inBedMilli !== null);
    expect(new Set(interior.map((n) => n.inBedMilli)).size).toBe(interior.length);
    expect(new Set(interior.map((n) => n.performancePct)).size).toBe(interior.length);
  });

  it("the no-data view is every date and no metrics at all", () => {
    for (const night of noDataView().nights) expect(night).toEqual(emptyNight(night.date));
    expect(noDataView().lastNight).toBeNull();
  });
});

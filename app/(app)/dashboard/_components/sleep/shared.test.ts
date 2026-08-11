/// <reference types="vitest/globals" />

import {
  STAGE_ORDER,
  asleepMilli,
  formatSleepDuration,
  formatSleepPercent,
  sleepNeedMilli,
  stageColor,
  stageLabel,
  stageMilli,
} from "./shared";
import {
  SCORED_ASLEEP_MILLI,
  SCORED_NEED_MILLI,
  emptyNight,
  partialNight,
  scoredNight,
} from "./fixtures";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("the stage ramp", () => {
  test("is ordinal by depth: deep → light → REM → awake", () => {
    expect(STAGE_ORDER).toEqual(["slowWave", "light", "rem", "awake"]);
  });

  test("maps onto the existing four-stop lift intensity ramp, darkest first", () => {
    // SOW Open Question 2's decided resolution: reuse the ramp the design
    // system already calls the canonical encoding of graded intensity. Zero
    // new tokens, so the SOW's `in-system` scope holds.
    expect(STAGE_ORDER.map(stageColor)).toEqual([
      "var(--discipline-lift-1)",
      "var(--discipline-lift-2)",
      "var(--discipline-lift-3)",
      "var(--discipline-lift-4)",
    ]);
  });

  test("never a raw hex, never the accent, never a status colour", () => {
    for (const stage of STAGE_ORDER) {
      const color = stageColor(stage);
      expect(color).not.toContain("#");
      expect(color).not.toContain("accent");
      expect(color).not.toContain("warning");
      expect(color).not.toContain("danger");
      expect(color).not.toContain("success");
    }
  });

  test("labels are the words a user knows, not the field names", () => {
    expect(STAGE_ORDER.map(stageLabel)).toEqual(["Deep", "Light", "REM", "Awake"]);
  });

  test("stageMilli reads each stage off the night", () => {
    const n = scoredNight();
    expect(stageMilli(n, "slowWave")).toBe(n.slowWaveSleepMilli);
    expect(stageMilli(n, "light")).toBe(n.lightSleepMilli);
    expect(stageMilli(n, "rem")).toBe(n.remSleepMilli);
    expect(stageMilli(n, "awake")).toBe(n.awakeMilli);
    expect(stageMilli(emptyNight("2026-08-11"), "rem")).toBeNull();
  });
});

describe("formatSleepDuration", () => {
  test("hours and minutes", () => {
    expect(formatSleepDuration(7 * HOUR + 23 * MIN)).toBe("7h 23m");
  });

  test("sub-hour prints minutes only", () => {
    expect(formatSleepDuration(48 * MIN)).toBe("48m");
    expect(formatSleepDuration(0)).toBe("0m");
  });

  test("keeps the minutes place on a whole hour so the column stays aligned", () => {
    expect(formatSleepDuration(8 * HOUR)).toBe("8h 0m");
  });

  test("past 24h it keeps counting hours rather than rolling over to days", () => {
    expect(formatSleepDuration(26 * HOUR + 5 * MIN)).toBe("26h 5m");
  });

  test("rounds to the nearest minute — a tile that prints seconds is lying", () => {
    expect(formatSleepDuration(90_000)).toBe("2m"); // 1m30s
    expect(formatSleepDuration(29_000)).toBe("0m"); // under half a minute
    expect(formatSleepDuration(7 * HOUR + 23 * MIN + 31_000)).toBe("7h 24m");
  });

  test("null, non-finite, and negative all read as an em dash", () => {
    expect(formatSleepDuration(null)).toBe("—");
    expect(formatSleepDuration(Number.NaN)).toBe("—");
    expect(formatSleepDuration(-1)).toBe("—");
  });
});

describe("formatSleepPercent", () => {
  test("rounds to a whole percent", () => {
    expect(formatSleepPercent(89.2)).toBe("89%");
    expect(formatSleepPercent(89.5)).toBe("90%");
    expect(formatSleepPercent(0)).toBe("0%");
  });

  test("null and non-finite read as an em dash, never NaN%", () => {
    expect(formatSleepPercent(null)).toBe("—");
    expect(formatSleepPercent(Number.NaN)).toBe("—");
    expect(formatSleepPercent(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("asleepMilli", () => {
  test("in bed minus awake minus no-data", () => {
    expect(asleepMilli(scoredNight())).toBe(SCORED_ASLEEP_MILLI);
  });

  test("null when any piece is missing", () => {
    expect(asleepMilli(partialNight())).toBeNull();
    expect(asleepMilli(scoredNight({ inBedMilli: null }))).toBeNull();
    expect(asleepMilli(scoredNight({ awakeMilli: null }))).toBeNull();
    expect(asleepMilli(scoredNight({ noDataMilli: null }))).toBeNull();
  });

  test("a contradictory night (more awake than in bed) is null, never negative", () => {
    expect(asleepMilli(scoredNight({ awakeMilli: 9 * HOUR }))).toBeNull();
  });
});

describe("sleepNeedMilli", () => {
  test("sums the four components signed", () => {
    expect(sleepNeedMilli(scoredNight())).toBe(SCORED_NEED_MILLI);
  });

  test("the nap component is subtracted, not clamped to zero", () => {
    const night = scoredNight();
    const withoutNap = sleepNeedMilli(scoredNight({ needFromNapMilli: 0 }));
    expect(night.needFromNapMilli).toBeLessThan(0);
    expect(sleepNeedMilli(night)).toBeLessThan(withoutNap as number);
    expect((withoutNap as number) - (sleepNeedMilli(night) as number)).toBe(15 * MIN);
  });

  test("null when any component is absent — a need with a hole is not a need", () => {
    expect(sleepNeedMilli(partialNight())).toBeNull();
    expect(sleepNeedMilli(scoredNight({ needBaselineMilli: null }))).toBeNull();
    expect(sleepNeedMilli(scoredNight({ needFromSleepDebtMilli: null }))).toBeNull();
    expect(sleepNeedMilli(scoredNight({ needFromStrainMilli: null }))).toBeNull();
    expect(sleepNeedMilli(scoredNight({ needFromNapMilli: null }))).toBeNull();
  });
});

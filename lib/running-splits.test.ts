import { describe, expect, it } from "vitest";
import { deriveRunningActivity, parseTargetPace, PACE_DROPOUT_SEC_PER_KM } from "./running-splits";
import { intervalTrackpoints, synthesize } from "./test-fixtures/running-trackpoints";

const METERS_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;

describe("deriveRunningActivity — splits", () => {
  it("Step 1: buckets per mile incl. a trailing partial split", () => {
    // ~2.2 mi steady run at 5:00/km (300 sec/km), sampled finely so bucket
    // boundaries land within one sample step of the mile mark.
    const tp = synthesize([
      { meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, sampleMeters: 10 },
    ]);
    const { splits } = deriveRunningActivity(tp, "easy", "mi");

    expect(splits).toHaveLength(3);
    expect(splits[0].partial).toBe(false);
    expect(splits[1].partial).toBe(false);
    expect(splits[2].partial).toBe(true);

    // A whole segment is bucketed by its start point, so a full split can
    // overshoot the mile by up to one sample step (~10 m here).
    expect(splits[0].distanceMeters).toBeGreaterThanOrEqual(METERS_PER_MILE);
    expect(splits[0].distanceMeters).toBeLessThan(METERS_PER_MILE + 11);
    expect(splits[1].distanceMeters).toBeGreaterThanOrEqual(METERS_PER_MILE);
    expect(splits[1].distanceMeters).toBeLessThan(METERS_PER_MILE + 11);
    // Trailing partial is ~0.2 mi.
    expect(splits[2].distanceMeters).toBeGreaterThan(0.15 * METERS_PER_MILE);
    expect(splits[2].distanceMeters).toBeLessThan(0.25 * METERS_PER_MILE);

    // Pace per mile ≈ 300 sec/km * 1.609344 ≈ 482.8 sec/mi.
    expect(splits[0].avgPaceSecPerUnit).toBeCloseTo(300 * KM_PER_MILE, 0);
  });

  it("Step 2: winsorizes a dropout out of the split stats", () => {
    // Steady 1.5 mi at 300 sec/km with one mid-run dropout sample at 1804 sec/km.
    const tp = synthesize([{ meters: 1.5 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150 }]);
    // Poison one mid-run sample's pace (keep distance/time honest).
    const mid = Math.floor(tp.length / 2);
    tp[mid] = { ...tp[mid], pace_sec_per_km: 1804 };

    const { splits, hasDropout } = deriveRunningActivity(tp, "easy", "mi");
    expect(hasDropout).toBe(true);
    // The poisoned sample lands in split 0 or 1; whichever, the clean pace stays ~482.8.
    for (const s of splits.filter((x) => !x.partial)) {
      expect(s.avgPaceSecPerUnit).not.toBeNull();
      expect(s.avgPaceSecPerUnit!).toBeGreaterThan(450);
      expect(s.avgPaceSecPerUnit!).toBeLessThan(520);
    }
  });

  it("Step 3: winsorization breaks the strip line at the dropout", () => {
    const tp = synthesize([{ meters: 1.0 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150 }]);
    const mid = Math.floor(tp.length / 2);
    tp[mid] = { ...tp[mid], pace_sec_per_km: 1804 };

    const { paceStrip } = deriveRunningActivity(tp, "easy", "mi");
    expect(paceStrip[mid].paceSecPerUnit).toBeNull();
    expect(paceStrip[mid - 1].paceSecPerUnit).not.toBeNull();
    expect(paceStrip[mid + 1].paceSecPerUnit).not.toBeNull();
  });

  it("Step 4: marks exactly one fastest + one slowest among full splits", () => {
    // Three distinct full miles: slow, medium, fast, then a tiny partial.
    const tp = synthesize([
      { meters: METERS_PER_MILE, paceSecPerKm: 340 },
      { meters: METERS_PER_MILE, paceSecPerKm: 300 },
      { meters: METERS_PER_MILE, paceSecPerKm: 260 },
      { meters: 0.1 * METERS_PER_MILE, paceSecPerKm: 300 },
    ]);
    const { splits } = deriveRunningActivity(tp, "easy", "mi");
    const full = splits.filter((s) => !s.partial);
    expect(full).toHaveLength(3);
    expect(splits.filter((s) => s.fastest)).toHaveLength(1);
    expect(splits.filter((s) => s.slowest)).toHaveLength(1);
    expect(full[2].fastest).toBe(true); // 260 sec/km = fastest
    expect(full[0].slowest).toBe(true); // 340 sec/km = slowest
    // Partial never marked.
    expect(splits[splits.length - 1].fastest).toBe(false);
    expect(splits[splits.length - 1].slowest).toBe(false);
  });

  it("Step 4b: marks neither when only one full split exists", () => {
    const tp = synthesize([
      { meters: METERS_PER_MILE, paceSecPerKm: 300 },
      { meters: 0.2 * METERS_PER_MILE, paceSecPerKm: 300 },
    ]);
    const { splits } = deriveRunningActivity(tp, "easy", "mi");
    expect(splits.filter((s) => s.fastest)).toHaveLength(0);
    expect(splits.filter((s) => s.slowest)).toHaveLength(0);
  });

  it("Step 5: stays honest about missing HR and elevation", () => {
    const noHr = synthesize([{ meters: 2 * METERS_PER_MILE, paceSecPerKm: 300, hr: null }]);
    const d1 = deriveRunningActivity(noHr, "easy", "mi");
    expect(d1.hasHr).toBe(false);
    for (const s of d1.splits) expect(s.avgHr).toBeNull();

    const noElev = synthesize([
      { meters: 2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, elevation: null },
    ]);
    const d2 = deriveRunningActivity(noElev, "easy", "mi");
    expect(d2.hasElevation).toBe(false);
    for (const s of d2.splits) expect(s.elevDeltaMeters).toBeNull();
  });

  it("Step 5b: surfaces HR and elevation when present", () => {
    const tp = synthesize([
      { meters: METERS_PER_MILE, paceSecPerKm: 300, hr: 150, elevation: 100 },
      { meters: METERS_PER_MILE, paceSecPerKm: 300, hr: 160, elevation: 120 },
    ]);
    const d = deriveRunningActivity(tp, "easy", "mi");
    expect(d.hasHr).toBe(true);
    expect(d.hasElevation).toBe(true);
    expect(d.splits[0].avgHr).toBeCloseTo(150, 0);
    expect(d.splits[0].elevDeltaMeters).toBeCloseTo(20, 0);
  });
});

describe("deriveRunningActivity — interval detection", () => {
  it("Step 6: detects an interval session positively", () => {
    const { intervals } = deriveRunningActivity(intervalTrackpoints(), "intervals", "mi");
    expect(intervals).not.toBeNull();
    const work = intervals!.filter((s) => s.kind === "work");
    expect(work.length).toBeGreaterThanOrEqual(3);
    expect(intervals![0].kind).toBe("warmup");
    expect(intervals![intervals!.length - 1].kind).toBe("cooldown");
    // rep numbers increment on work bouts.
    const reps = work.map((w) => w.rep);
    for (let i = 1; i < reps.length; i++) {
      expect(reps[i]!).toBeGreaterThan(reps[i - 1]!);
    }
    expect(work[0].label).toBe("Rep 1");
  });

  it("Step 7: returns null for an easy run and for a steady intervals run", () => {
    const steady = synthesize([{ meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150 }]);
    expect(deriveRunningActivity(steady, "easy", "mi").intervals).toBeNull();
    // Same steady trace but mislabeled intervals → fails closed.
    expect(deriveRunningActivity(steady, "intervals", "mi").intervals).toBeNull();
  });

  it("Step 8: returns null when the trace is too sparse", () => {
    // Few, far-apart samples → fewer than 8 clean segments.
    const sparse = synthesize([{ meters: 800, paceSecPerKm: 300, hr: 150, sampleMeters: 200 }]);
    expect(deriveRunningActivity(sparse, "intervals", "mi").intervals).toBeNull();
  });
});

describe("deriveRunningActivity — unit switching", () => {
  it("Step 9: km buckets are smaller + paces scale by KM_PER_MILE", () => {
    const tp = synthesize([{ meters: 3200, paceSecPerKm: 300, hr: 150 }]);
    const inMi = deriveRunningActivity(tp, "easy", "mi");
    const inKm = deriveRunningActivity(tp, "easy", "km");
    // 3200 m → 2 full mi + partial (3 buckets); 3 full km + partial (4 buckets).
    expect(inKm.splits.length).toBeGreaterThan(inMi.splits.length);

    const paceKm = inKm.splits[0].avgPaceSecPerUnit!;
    const paceMi = inMi.splits[0].avgPaceSecPerUnit!;
    expect(paceKm).toBeCloseTo(300, 0);
    expect(paceMi).toBeCloseTo(300 * KM_PER_MILE, 0);
    expect(paceMi / paceKm).toBeCloseTo(KM_PER_MILE, 2);
  });
});

describe("parseTargetPace", () => {
  it("Step 10: parses a unit-qualified pace and converts to the active unit", () => {
    const text = "Workout: 8 × 400m @ 5K effort (~6:30/mi) with 200m jog recovery.";
    expect(parseTargetPace(text, "mi")!).toBe(390);
    expect(parseTargetPace(text, "km")!).toBe(Math.round(390 / KM_PER_MILE));
  });

  it("Step 10b: returns null without a unit-qualified pace", () => {
    expect(parseTargetPace("8 × 400m hard", "mi")).toBeNull();
    expect(parseTargetPace(null, "mi")).toBeNull();
    expect(parseTargetPace("threshold for 20 minutes", "km")).toBeNull();
  });

  it("Step 10c: converts a /km token to the active mi unit", () => {
    expect(parseTargetPace("tempo @ 4:00/km", "km")).toBe(240);
    expect(parseTargetPace("tempo @ 4:00/km", "mi")).toBe(Math.round(240 * KM_PER_MILE));
  });

  it("Step 10d: accepts 'per mile' / 'per km' phrasing", () => {
    expect(parseTargetPace("hold 7:30 per mile", "mi")).toBe(450);
    expect(parseTargetPace("hold 5:00 per kilometer", "km")).toBe(300);
  });
});

describe("constants", () => {
  it("exposes the dropout threshold", () => {
    expect(PACE_DROPOUT_SEC_PER_KM).toBe(410);
  });
});

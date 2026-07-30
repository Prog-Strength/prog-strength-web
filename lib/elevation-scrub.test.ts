/// <reference types="vitest/globals" />
import type { RunningTrackpoint } from "@/lib/api";
import {
  METERS_PER_MILE,
  coordAt,
  mileMarkers,
  nearestTrackpointIndex,
  readoutAt,
  remainingClimb,
  totalDistanceMeters,
  travelledSegments,
} from "./elevation-scrub";

/** One trackpoint; nulls model a sample that lacked position or elevation. */
function tp(
  i: number,
  distance: number,
  elevation: number | null,
  coord: [number, number] | null = [-106.06 - i * 0.001, 39.39 + i * 0.001],
  grade: number | null = null,
): RunningTrackpoint {
  return {
    sequence: i,
    elapsed_seconds: i * 10,
    distance_meters: distance,
    heart_rate_bpm: null,
    pace_sec_per_km: null,
    elevation_meters: elevation,
    clean_pace: false,
    longitude: coord?.[0] ?? null,
    latitude: coord?.[1] ?? null,
    grade_percent: grade,
  };
}

/** Climb of `rise` metres per 100 m step. */
function climbTrack(n: number, rise: number): RunningTrackpoint[] {
  return Array.from({ length: n + 1 }, (_, i) => tp(i, i * 100, 3000 + i * rise));
}

describe("remainingClimb", () => {
  it("sums only the ascent still ahead", () => {
    const climb = remainingClimb(climbTrack(4, 10));
    expect(climb).toEqual([40, 30, 20, 10, 0]);
  });

  it("ignores descent", () => {
    // Up 10, up 10, down 20, up 5 → from the start only 25 m of ascent remains.
    const tps = [
      tp(0, 0, 3000),
      tp(1, 100, 3010),
      tp(2, 200, 3020),
      tp(3, 300, 3000),
      tp(4, 400, 3005),
    ];
    expect(remainingClimb(tps)[0]).toBe(25);
  });

  it("is zero at the last sample", () => {
    const climb = remainingClimb(climbTrack(6, 12));
    expect(climb[climb.length - 1]).toBe(0);
  });

  // A gap must neither invent climb nor swallow it — the same refusal to bridge
  // a null that the recap charts and the server-side grade both make.
  it("skips pairs where either endpoint has no elevation", () => {
    const tps = [tp(0, 0, 3000), tp(1, 100, null), tp(2, 200, 3050)];
    // Neither 0→1 nor 1→2 is a measurable pair, so nothing is counted.
    expect(remainingClimb(tps)[0]).toBe(0);
  });

  it("handles an empty and a single-point track", () => {
    expect(remainingClimb([])).toEqual([]);
    expect(remainingClimb([tp(0, 0, 3000)])).toEqual([0]);
  });
});

describe("readoutAt", () => {
  const tps = climbTrack(4, 10).map((p, i) => ({ ...p, grade_percent: i === 2 ? 12.5 : null }));
  const climb = remainingClimb(tps);

  it("reports elevation, grade, remaining climb and remaining distance", () => {
    expect(readoutAt(tps, climb, 2)).toEqual({
      elevationMeters: 3020,
      gradePercent: 12.5,
      remainingClimbMeters: 20,
      remainingDistanceMeters: 200,
    });
  });

  it("reports an all-null readout with no cursor", () => {
    const r = readoutAt(tps, climb, null);
    expect(r.elevationMeters).toBeNull();
    expect(r.remainingDistanceMeters).toBeNull();
  });

  // A stale index left over from a previously-viewed activity must not throw
  // mid-render.
  it("survives an out-of-range index", () => {
    expect(readoutAt(tps, climb, 999).elevationMeters).toBeNull();
    expect(readoutAt(tps, climb, -1).elevationMeters).toBeNull();
    expect(readoutAt([], [], 0).elevationMeters).toBeNull();
  });

  it("never reports negative remaining distance at the finish", () => {
    expect(readoutAt(tps, climb, tps.length - 1).remainingDistanceMeters).toBe(0);
  });

  it("distinguishes a flat grade from an absent one", () => {
    const flat = [{ ...tps[1], grade_percent: 0 }];
    expect(readoutAt(flat, [0], 0).gradePercent).toBe(0);
    expect(readoutAt(tps, climb, 1).gradePercent).toBeNull();
  });
});

describe("coordAt", () => {
  it("returns GeoJSON order", () => {
    const tps = climbTrack(2, 10);
    expect(coordAt(tps, 1)).toEqual([-106.061, 39.391]);
  });

  it("returns null for a sample with no position and for a bad index", () => {
    const tps = [tp(0, 0, 3000, null)];
    expect(coordAt(tps, 0)).toBeNull();
    expect(coordAt(tps, 5)).toBeNull();
    expect(coordAt(tps, null)).toBeNull();
  });
});

describe("travelledSegments", () => {
  it("covers the start through the cursor inclusive", () => {
    const segs = travelledSegments(climbTrack(5, 10), 3);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(4);
  });

  it("is empty with no cursor", () => {
    expect(travelledSegments(climbTrack(5, 10), null)).toEqual([]);
  });

  // A straight line across a GPS dropout is a claim about where the hiker went,
  // and it is usually wrong.
  it("breaks rather than bridging a run of positionless samples", () => {
    const tps = [
      tp(0, 0, 3000),
      tp(1, 100, 3010),
      tp(2, 200, 3020, null),
      tp(3, 300, 3030, null),
      tp(4, 400, 3040),
      tp(5, 500, 3050),
    ];
    const segs = travelledSegments(tps, 5);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(2);
    expect(segs[1]).toHaveLength(2);
  });

  it("drops a one-point segment, which would draw nothing", () => {
    const tps = [tp(0, 0, 3000), tp(1, 100, 3010, null), tp(2, 200, 3020)];
    expect(travelledSegments(tps, 2)).toEqual([]);
  });

  it("clamps a cursor past the end", () => {
    const segs = travelledSegments(climbTrack(3, 10), 999);
    expect(segs[0]).toHaveLength(4);
  });
});

describe("mileMarkers", () => {
  it("places one marker per whole unit boundary", () => {
    // 4 miles of track, sampled every ~160 m.
    const n = 40;
    const tps = Array.from({ length: n + 1 }, (_, i) =>
      tp(i, (i * 4 * METERS_PER_MILE) / n, 3000 + i),
    );
    expect(mileMarkers(tps, "mi").map((m) => m.label)).toEqual(["1", "2", "3"]);
  });

  it("re-derives for kilometres without new data", () => {
    const tps = Array.from({ length: 51 }, (_, i) => tp(i, i * 100, 3000 + i));
    // 5 km of track → markers at 1..4; the 5 km boundary is the finish.
    expect(mileMarkers(tps, "km").map((m) => m.label)).toEqual(["1", "2", "3", "4"]);
  });

  it("emits no marker at the finish, where it would collide with the end dot", () => {
    const tps = Array.from({ length: 21 }, (_, i) => tp(i, i * 100, 3000));
    // Exactly 2 km: markers at 1 only.
    expect(mileMarkers(tps, "km").map((m) => m.label)).toEqual(["1"]);
  });

  // A long gap between samples clears several boundaries at once; they must not
  // stack on one coordinate.
  it("does not stack markers when one sample clears several boundaries", () => {
    const tps = [tp(0, 0, 3000), tp(1, 3500, 3100), tp(2, 4000, 3200)];
    const marks = mileMarkers(tps, "km");
    expect(marks.map((m) => m.label)).toEqual(["1"]);
    expect(new Set(marks.map((m) => m.coord.join(","))).size).toBe(marks.length);
  });

  it("returns nothing for a track shorter than one unit", () => {
    expect(mileMarkers([tp(0, 0, 3000), tp(1, 400, 3010)], "km")).toEqual([]);
    expect(mileMarkers([], "km")).toEqual([]);
  });

  it("skips boundaries whose sample carried no position", () => {
    const tps = [tp(0, 0, 3000), tp(1, 1000, 3010, null), tp(2, 2500, 3020)];
    expect(mileMarkers(tps, "km").map((m) => m.label)).toEqual(["2"]);
  });
});

describe("nearestTrackpointIndex", () => {
  const tps = climbTrack(5, 10);

  it("finds the closest sample to a map position", () => {
    const c = coordAt(tps, 3)!;
    expect(nearestTrackpointIndex(tps, c[0], c[1])).toBe(3);
  });

  it("still finds the closest when the position is between samples", () => {
    const a = coordAt(tps, 2)!;
    const b = coordAt(tps, 3)!;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    expect([2, 3]).toContain(nearestTrackpointIndex(tps, mid[0], mid[1]));
  });

  it("ignores samples with no position", () => {
    const withGap = [tp(0, 0, 3000, null), tp(1, 100, 3010, [-106.061, 39.391])];
    expect(nearestTrackpointIndex(withGap, -106.061, 39.391)).toBe(1);
  });

  it("returns null when nothing carries a position", () => {
    expect(nearestTrackpointIndex([tp(0, 0, 3000, null)], -106, 39)).toBeNull();
    expect(nearestTrackpointIndex([], -106, 39)).toBeNull();
  });
});

describe("totalDistanceMeters", () => {
  it("is the last sample's cumulative distance", () => {
    expect(totalDistanceMeters(climbTrack(4, 10))).toBe(400);
  });
  it("is zero for an empty track", () => {
    expect(totalDistanceMeters([])).toBe(0);
  });
});

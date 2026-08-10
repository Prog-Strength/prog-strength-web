/**
 * Pins the one invariant these fixtures exist to model: a view's LAST day
 * agrees exactly with its scalar `hrv` block — same bounds, same z, same
 * status — and its `baselineAvg` matches the `baseline` block's `hrvAvg`.
 *
 * Server-side this is structural: `ComputeSeries` and `Compute` derive both
 * blocks from the same `band`/`classify` helpers, so they cannot disagree. A
 * fixture where they DO disagree therefore describes a payload the API cannot
 * emit — and the drifting-band tile is being built against these exact views,
 * so such a fixture would render a plausible-looking tile asserting an
 * impossible state rather than failing loudly. The numbers are duplicated by
 * hand in fixtures.ts (once in `days[last]`, once in `hrv`); this test is what
 * keeps the two copies honest.
 *
 * `legacyView` is deliberately EXCLUDED: it is the pre-derived-blocks payload
 * and has no `days` and no `hrv`, so the invariant does not apply to it.
 * Please do not "helpfully" add it.
 */

import { describe, expect, it } from "vitest";
import { balancedView, calibratingView, noReadingView, suppressedView } from "./fixtures";

const VIEWS = [
  ["suppressedView", suppressedView],
  ["balancedView", balancedView],
  ["calibratingView", calibratingView],
  ["noReadingView", noReadingView],
] as const;

describe.each(VIEWS)("%s — last day agrees with the scalar blocks", (_name, build) => {
  const view = build();
  const last = view.days?.at(-1);

  it("has a last day, an hrv block, and a baseline block", () => {
    expect(last).toBeDefined();
    expect(view.hrv).toBeDefined();
    expect(view.baseline).toBeDefined();
  });

  it("matches the hrv block's band bounds", () => {
    expect(last!.balancedLow).toBe(view.hrv!.balancedLow);
    expect(last!.balancedHigh).toBe(view.hrv!.balancedHigh);
  });

  it("matches the hrv block's z-score and status", () => {
    expect(last!.zScore).toBe(view.hrv!.zScore);
    expect(last!.status).toBe(view.hrv!.status);
  });

  it("matches the baseline block's hrv average", () => {
    expect(last!.baselineAvg).toBe(view.baseline!.hrvAvg);
  });
});

import { describe, expect, it } from "vitest";
import {
  loadStatus,
  loadStatusColor,
  signedPct,
  signed,
  paceDelta,
  weekdayLabel,
  coverageCaption,
  zoneToken,
} from "./shared";

describe("loadStatus", () => {
  it("maps a zero-run week to resting regardless of delta", () => {
    expect(loadStatus(-100, 0)).toBe("resting");
  });
  it("maps +25% to ramping — and its color is warning, never danger", () => {
    expect(loadStatus(25, 4)).toBe("ramping");
    expect(loadStatusColor("ramping")).toBe("var(--warning)");
    expect(loadStatusColor("ramping")).not.toBe("var(--danger)");
  });
  it("maps a steady build to building/success", () => {
    expect(loadStatus(0, 3)).toBe("building");
    expect(loadStatus(9.9, 3)).toBe("building");
    expect(loadStatusColor("building")).toBe("var(--success)");
  });
  it("maps a down week to easing/muted — never danger", () => {
    expect(loadStatus(-30, 2)).toBe("easing");
    expect(loadStatusColor("easing")).toBe("var(--muted)");
    expect(loadStatusColor("easing")).not.toBe("var(--danger)");
  });
  it("maps resting to muted", () => {
    expect(loadStatusColor("resting")).toBe("var(--muted)");
  });
});

describe("signedPct / signed", () => {
  it("formats with a unicode minus", () => {
    expect(signedPct(25.3)).toBe("+25%");
    expect(signedPct(-100)).toBe("−100%");
    expect(signedPct(0)).toBe("±0%");
    expect(signed(3)).toBe("+3");
    expect(signed(-17)).toBe("−17");
    expect(signed(0)).toBe("±0");
  });
});

describe("paceDelta", () => {
  it("converts the sec/km delta into the display unit's seconds", () => {
    // 378.6 vs 381.2 s/km is −2.6 s/km ≈ −4 s/mi.
    expect(paceDelta(378.6, 381.2, "mi")).toBe("−4s");
    expect(paceDelta(378.6, 381.2, "km")).toBe("−3s");
    expect(paceDelta(381.2, 381.2, "mi")).toBe("±0s");
    expect(paceDelta(390, 381.2, "km")).toBe("+9s");
  });
});

describe("weekdayLabel", () => {
  it("parses a local date with no timezone drift", () => {
    // 2026-08-01 is a Saturday everywhere — a UTC-parse off-by-one would say Fri.
    expect(weekdayLabel("2026-08-01")).toBe("Sat");
    expect(weekdayLabel("2026-07-27")).toBe("Mon");
  });
  it("degrades malformed input to an em-dash", () => {
    expect(weekdayLabel("not-a-date")).toBe("—");
  });
});

describe("coverageCaption", () => {
  it("states coverage honestly", () => {
    expect(coverageCaption(3, 4)).toBe("3 of 4 runs");
    expect(coverageCaption(0, 1)).toBe("0 of 1 run");
  });
});

describe("zoneToken", () => {
  it("maps 1..5 to the zone scale and everything else to neutral ink", () => {
    expect(zoneToken(3)).toBe("var(--zone-3)");
    expect(zoneToken(1)).toBe("var(--zone-1)");
    expect(zoneToken(5)).toBe("var(--zone-5)");
    expect(zoneToken(null)).toBe("var(--muted)");
    expect(zoneToken(0)).toBe("var(--muted)");
    expect(zoneToken(6)).toBe("var(--muted)");
  });
});

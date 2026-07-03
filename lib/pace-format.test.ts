/// <reference types="vitest/globals" />

import { formatPaceClock, formatPaceClockOrDash, formatPaceDelta } from "./pace-format";

describe("formatPaceClock", () => {
  it("formats a typical pace as m:ss", () => {
    expect(formatPaceClock(348)).toBe("5:48");
  });

  it("zero-pads a sub-minute value", () => {
    expect(formatPaceClock(42)).toBe("0:42");
  });

  it("rounds to the nearest second (no unit conversion)", () => {
    expect(formatPaceClock(299.6)).toBe("5:00");
  });

  it("returns an em-dash for non-finite input", () => {
    expect(formatPaceClock(NaN)).toBe("—");
    expect(formatPaceClock(Infinity)).toBe("—");
    expect(formatPaceClock(-Infinity)).toBe("—");
  });

  it("returns an em-dash for negative input rather than a malformed clock", () => {
    expect(formatPaceClock(-5)).toBe("—");
    expect(formatPaceClock(-65)).toBe("—");
  });
});

describe("formatPaceClockOrDash", () => {
  it("dashes null and delegates otherwise", () => {
    expect(formatPaceClockOrDash(null)).toBe("—");
    expect(formatPaceClockOrDash(626)).toBe("10:26");
  });
});

describe("formatPaceDelta", () => {
  it("signs and formats", () => {
    expect(formatPaceDelta(-65)).toBe("−1:05");
    expect(formatPaceDelta(5)).toBe("+0:05");
  });
});

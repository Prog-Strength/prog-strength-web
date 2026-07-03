/// <reference types="vitest/globals" />

import { formatPaceClock } from "./pace-format";

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

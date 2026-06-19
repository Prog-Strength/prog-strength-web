/// <reference types="vitest/globals" />

import { compact } from "./compact";

describe("compact", () => {
  it("formats sub-10k numbers exactly with thousands separators", () => {
    expect(compact(0)).toBe("0");
    expect(compact(42)).toBe("42");
    expect(compact(1840)).toBe("1,840");
    expect(compact(9999)).toBe("9,999");
  });

  it("collapses thousands to a 'k' suffix at and above 10k", () => {
    expect(compact(10_000)).toBe("10k");
    expect(compact(14_000)).toBe("14k");
    expect(compact(14_500)).toBe("14.5k");
  });

  it("collapses millions and billions", () => {
    expect(compact(2_400_000)).toBe("2.4M");
    expect(compact(5_000_000)).toBe("5M");
    expect(compact(1_200_000_000)).toBe("1.2B");
  });

  it("preserves the sign on negatives", () => {
    expect(compact(-1840)).toBe("-1,840");
    expect(compact(-14_000)).toBe("-14k");
  });

  it("rounds fractional sub-10k inputs to a whole number", () => {
    expect(compact(1840.6)).toBe("1,841");
  });

  it("degrades non-finite input to an em-dash (never NaN)", () => {
    expect(compact(NaN)).toBe("—");
    expect(compact(Infinity)).toBe("—");
    expect(compact(-Infinity)).toBe("—");
  });
});

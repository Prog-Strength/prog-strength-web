/// <reference types="vitest/globals" />

import { formatPercent } from "./format";

describe("formatPercent", () => {
  it("renders a 0..1 fraction as a whole-number percent", () => {
    expect(formatPercent(0.076)).toBe("8%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("renders an em-dash for non-finite input", () => {
    expect(formatPercent(NaN)).toBe("—");
    expect(formatPercent(Infinity)).toBe("—");
  });
});

import { describe, expect, test } from "vitest";
import { weatherKind, weatherTheme, weatherWash } from "./weather-theme";

describe("weatherKind", () => {
  test("maps each OpenWeather family to its condition", () => {
    expect(weatherKind("01d")).toBe("clear");
    expect(weatherKind("02d")).toBe("clouds");
    expect(weatherKind("03n")).toBe("clouds");
    expect(weatherKind("04d")).toBe("clouds");
    expect(weatherKind("09d")).toBe("rain");
    expect(weatherKind("10n")).toBe("rain");
    expect(weatherKind("11d")).toBe("storm");
    expect(weatherKind("13d")).toBe("snow");
    expect(weatherKind("50d")).toBe("fog");
  });

  test("day and night variants share a condition", () => {
    expect(weatherKind("01n")).toBe(weatherKind("01d"));
    expect(weatherKind("10n")).toBe(weatherKind("10d"));
  });

  test("an unknown or missing code reads as the neutral of the six", () => {
    // A code the provider grows later must be quiet, not conspicuous — and it
    // must agree with the glyph, which falls back to the plain cloud.
    expect(weatherKind("77x")).toBe("clouds");
    expect(weatherKind("")).toBe("clouds");
    expect(weatherKind(undefined)).toBe("clouds");
  });
});

describe("weatherTheme", () => {
  test("every condition carries a token pair, never a raw hex", () => {
    for (const icon of ["01d", "03d", "09d", "11d", "13d", "50d"]) {
      const theme = weatherTheme(icon);
      expect(theme.tone).toMatch(/^var\(--weather-[a-z]+\)$/);
      expect(theme.tint).toMatch(/^var\(--weather-[a-z]+-soft\)$/);
      expect(theme.label.length).toBeGreaterThan(0);
    }
  });

  test("the six conditions are visually distinct from each other", () => {
    const tones = new Set(
      ["01d", "03d", "09d", "11d", "13d", "50d"].map((i) => weatherTheme(i).tone),
    );
    expect(tones.size).toBe(6);
  });

  test("no condition borrows the app's own accent", () => {
    // A forecast that reads as app chrome is a forecast the eye skips.
    for (const icon of ["01d", "03d", "09d", "11d", "13d", "50d"]) {
      expect(weatherTheme(icon).tone).not.toContain("--accent");
    }
  });
});

describe("weatherWash", () => {
  test("fades the condition tint out well before the bottom of the card", () => {
    const wash = weatherWash("09d");
    expect(wash).toContain("var(--weather-rain-soft)");
    expect(wash).toContain("transparent");
  });
});

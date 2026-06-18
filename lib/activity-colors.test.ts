/// <reference types="vitest/globals" />
import { activityColors, activityRingClass } from "./activity-colors";

describe("activityColors", () => {
  it("resolves run to the run discipline tokens", () => {
    expect(activityColors("run")).toEqual({
      dot: "var(--discipline-run-dot)",
      bg: "var(--discipline-run-bg)",
      fg: "var(--discipline-run-fg)",
    });
  });

  it("resolves lift to the lift discipline tokens", () => {
    expect(activityColors("lift")).toEqual({
      dot: "var(--discipline-lift-dot)",
      bg: "var(--discipline-lift-bg)",
      fg: "var(--discipline-lift-fg)",
    });
  });

  it("never resolves to the violet accent or a hardcoded emerald", () => {
    for (const type of ["run", "lift"] as const) {
      const tokens = activityColors(type);
      const joined = `${tokens.dot} ${tokens.bg} ${tokens.fg}`;
      expect(joined).not.toMatch(/accent/);
      expect(joined).not.toMatch(/emerald/);
    }
  });

  it("falls back to a neutral token set for reserved/unmapped disciplines", () => {
    const neutral = { dot: "var(--border)", bg: "var(--surface-2)", fg: "var(--muted)" };
    expect(activityColors("mobility")).toEqual(neutral);
    expect(activityColors("core")).toEqual(neutral);
  });
});

describe("activityRingClass", () => {
  it("returns the discipline-toned focus ring class for run and lift", () => {
    expect(activityRingClass("run")).toBe("focus-visible:ring-[var(--discipline-run-dot)]");
    expect(activityRingClass("lift")).toBe("focus-visible:ring-[var(--discipline-lift-dot)]");
  });

  it("falls back to a neutral ring for reserved disciplines", () => {
    expect(activityRingClass("mobility")).toBe("focus-visible:ring-[var(--border)]");
  });
});

import { describe, expect, it } from "vitest";
import { formatElapsed } from "@/components/live-workout/duration-clock";

const SEC = 1000;

describe("formatElapsed", () => {
  it("formats sub-minute as M:SS", () => {
    expect(formatElapsed(0, 5 * SEC)).toBe("0:05");
    expect(formatElapsed(0, 59 * SEC)).toBe("0:59");
  });

  it("formats minutes as M:SS without a leading-zero minute", () => {
    expect(formatElapsed(0, 90 * SEC)).toBe("1:30");
    expect(formatElapsed(0, 10 * 60 * SEC)).toBe("10:00");
  });

  it("switches to H:MM:SS past the hour", () => {
    expect(formatElapsed(0, 3600 * SEC)).toBe("1:00:00");
    expect(formatElapsed(0, (3600 + 125) * SEC)).toBe("1:02:05");
  });

  it("clamps negative elapsed to zero", () => {
    expect(formatElapsed(10 * SEC, 0)).toBe("0:00");
  });

  it("works with real RFC3339 timestamps", () => {
    const from = new Date("2026-06-14T10:00:00Z").getTime();
    const now = new Date("2026-06-14T10:45:30Z").getTime();
    expect(formatElapsed(from, now)).toBe("45:30");
  });
});

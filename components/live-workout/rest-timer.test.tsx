import { describe, expect, it } from "vitest";
import { remainingSeconds } from "@/components/live-workout/rest-timer";

describe("remainingSeconds", () => {
  const started = "2026-06-14T10:00:00.000Z";
  const startedMs = new Date(started).getTime();

  it("returns the full duration at the start", () => {
    expect(remainingSeconds(started, 90, startedMs)).toBe(90);
  });

  it("counts down with elapsed time", () => {
    expect(remainingSeconds(started, 90, startedMs + 30_000)).toBe(60);
  });

  it("rounds up partial seconds so the display never shows 0 early", () => {
    expect(remainingSeconds(started, 90, startedMs + 30_500)).toBe(60);
    expect(remainingSeconds(started, 90, startedMs + 89_100)).toBe(1);
  });

  it("clamps to zero at and past the end", () => {
    expect(remainingSeconds(started, 90, startedMs + 90_000)).toBe(0);
    expect(remainingSeconds(started, 90, startedMs + 200_000)).toBe(0);
  });
});

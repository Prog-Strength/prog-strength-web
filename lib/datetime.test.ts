import { describe, expect, it } from "vitest";
import {
  localInputToRFC3339,
  rfc3339ToLocalInput,
  rfc3339ToSchedule,
  scheduleToRFC3339,
} from "./datetime";

describe("datetime helpers", () => {
  it("round-trips a local datetime-local value through RFC3339 and back", () => {
    // A datetime-local value carries no timezone; localInputToRFC3339
    // interprets it in the host's local tz and rfc3339ToLocalInput formats
    // back into the same local tz, so the round-trip is lossless to the
    // minute regardless of which timezone the test runs in.
    const local = "2026-05-17T14:30";
    const iso = localInputToRFC3339(local);
    expect(rfc3339ToLocalInput(iso)).toBe(local);
  });

  it("produces a zero-padded YYYY-MM-DDTHH:MM value", () => {
    // Build the input from an explicit local Date so the expectation is
    // tz-independent.
    const d = new Date(2026, 0, 3, 9, 5); // Jan 3 2026, 09:05 local
    const out = rfc3339ToLocalInput(d.toISOString());
    expect(out).toBe("2026-01-03T09:05");
  });

  it("serializes a local input to a UTC RFC3339 instant", () => {
    const iso = localInputToRFC3339("2026-05-17T14:30");
    // Same instant either way: parsing the RFC3339 string yields the same
    // epoch as parsing the original local string.
    expect(new Date(iso).getTime()).toBe(new Date("2026-05-17T14:30").getTime());
    expect(iso.endsWith("Z")).toBe(true);
  });
});

describe("schedule (date + time + duration) helpers", () => {
  it("derives end = start + duration and round-trips back to the form shape", () => {
    const { start, end } = scheduleToRFC3339("2026-06-16", "07:15", 90);
    // end is 90 minutes after start, to the millisecond.
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(90 * 60_000);

    const back = rfc3339ToSchedule(start, end);
    expect(back).toEqual({ date: "2026-06-16", time: "07:15", durationMin: 90 });
  });

  it("floors a degenerate/inverted window to a 15-minute duration", () => {
    const { date, time, durationMin } = rfc3339ToSchedule(
      "2026-06-16T07:15:00Z",
      "2026-06-16T07:15:00Z",
    );
    expect(durationMin).toBe(15);
    expect(typeof date).toBe("string");
    expect(typeof time).toBe("string");
  });
});

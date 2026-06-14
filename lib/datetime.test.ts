import { describe, expect, it } from "vitest";
import { localInputToRFC3339, rfc3339ToLocalInput } from "./datetime";

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

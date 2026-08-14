import { describe, expect, test } from "vitest";
import type { RecoveryBaselineTrendView } from "@/lib/dashboard";
import {
  driftColor,
  driftGlyph,
  driftTag,
  hrvStatusColor,
  MIN_BASELINE_DAYS,
  ordinal,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
  round,
  signed,
  statusWord,
  weekday,
} from "./shared";

function drift(over: Partial<RecoveryBaselineTrendView> = {}): RecoveryBaselineTrendView {
  return { direction: "rising", deltaMs: 6.4, fromAvg: 84.8, overDays: 28, ...over };
}

describe("hrvStatusColor — the SOW color contract", () => {
  test("suppressed maps to --warning and never --danger", () => {
    expect(hrvStatusColor("suppressed")).toBe("var(--warning)");
    expect(hrvStatusColor("suppressed")).not.toContain("danger");
  });

  test("elevated maps to --accent and never --success (unusual, not extra good)", () => {
    expect(hrvStatusColor("elevated")).toBe("var(--accent)");
    expect(hrvStatusColor("elevated")).not.toContain("success");
  });

  test("balanced maps to --success", () => {
    expect(hrvStatusColor("balanced")).toBe("var(--success)");
  });

  test("unknown maps to --muted", () => {
    expect(hrvStatusColor("unknown")).toBe("var(--muted)");
  });
});

describe("statusWord", () => {
  test("house words in sentence case", () => {
    expect(statusWord("suppressed")).toBe("Suppressed");
    expect(statusWord("balanced")).toBe("Balanced");
    expect(statusWord("elevated")).toBe("Elevated");
    expect(statusWord("unknown")).toBe("Calibrating");
  });

  test("unknown splits on why: no reading yet vs still calibrating", () => {
    expect(statusWord("unknown", false)).toBe("No reading yet");
    expect(statusWord("unknown", true)).toBe("Calibrating");
    // The default keeps the other recovery tiles' behaviour byte-for-byte.
    expect(statusWord("unknown")).toBe("Calibrating");
  });

  test("the other three statuses ignore hasReading", () => {
    expect(statusWord("suppressed", false)).toBe("Suppressed");
    expect(statusWord("balanced", false)).toBe("Balanced");
    expect(statusWord("elevated", false)).toBe("Elevated");
  });
});

describe("signed", () => {
  test("positive carries a plus", () => {
    expect(signed(3.2)).toBe("+3");
  });

  test("negative carries a unicode minus, not an ascii hyphen", () => {
    expect(signed(-17.2)).toBe("−17");
    expect(signed(-17.2)).not.toBe("-17");
  });

  test("zero is ±0, including a sub-half value that rounds to zero", () => {
    expect(signed(0)).toBe("±0");
    expect(signed(-0.2)).toBe("±0");
  });

  test("respects the digits argument", () => {
    expect(signed(-1.44, 1)).toBe("−1.4");
  });
});

describe("driftGlyph", () => {
  test("a glyph per direction", () => {
    expect(driftGlyph("rising")).toBe("▲");
    expect(driftGlyph("falling")).toBe("▼");
    expect(driftGlyph("steady")).toBe("▬");
    expect(driftGlyph("unknown")).toBe("·");
  });
});

describe("driftColor", () => {
  test("rising is success, falling is warning", () => {
    expect(driftColor("rising")).toBe("var(--success)");
    expect(driftColor("falling")).toBe("var(--warning)");
  });

  test("steady is muted, so an ordinary month reads calm", () => {
    expect(driftColor("steady")).toBe("var(--muted)");
  });

  test("unknown is muted", () => {
    expect(driftColor("unknown")).toBe("var(--muted)");
  });
});

describe("driftTag", () => {
  test("formats a rising drift as glyph, signed delta, and whole weeks", () => {
    expect(driftTag(drift())).toBe("▲ +6 ms · 4w");
  });

  test("a falling drift carries a unicode minus, not an ascii hyphen", () => {
    const tag = driftTag(drift({ direction: "falling", deltaMs: -8.1 }));
    expect(tag).toBe("▼ −8 ms · 4w");
    expect(tag).not.toContain("-8");
  });

  test("a steady direction still prints its magnitude", () => {
    expect(driftTag(drift({ direction: "steady" }))).toBe("▬ +6 ms · 4w");
  });

  test("an unknown direction is a shrug", () => {
    expect(driftTag(drift({ direction: "unknown" }))).toBe("drift not yet known");
  });

  test("a null delta is a shrug", () => {
    expect(driftTag(drift({ deltaMs: null }))).toBe("drift not yet known");
  });

  test("respects the unit argument", () => {
    expect(driftTag(drift(), " bpm")).toBe("▲ +6 bpm · 4w");
  });
});

describe("weekday", () => {
  test("parses a local date with no timezone drift", () => {
    // Parsed as local Y/M/D parts, 2026-08-01 is a Saturday in every timezone.
    expect(weekday("2026-08-01")).toBe("Sat");
    expect(weekday("2026-07-31")).toBe("Fri");
  });

  test("malformed input degrades to an em-dash", () => {
    expect(weekday("nope")).toBe("—");
  });
});

describe("recoveryBand — Whoop's published cut points, single-sourced", () => {
  test("green at and above 67", () => {
    expect(recoveryBand(100)).toBe("green");
    expect(recoveryBand(67)).toBe("green");
  });

  test("yellow from 34 to 66 — the boundaries are the whole point of this function", () => {
    expect(recoveryBand(66)).toBe("yellow");
    expect(recoveryBand(34)).toBe("yellow");
  });

  test("red at and below 33", () => {
    expect(recoveryBand(33)).toBe("red");
    expect(recoveryBand(0)).toBe("red");
  });

  test("no score is no band, never a red zero", () => {
    expect(recoveryBand(null)).toBe("none");
  });
});

describe("recoveryBandWord", () => {
  test("Whoop's words for a score, and the house word for an absence", () => {
    expect(recoveryBandWord("green")).toBe("Recovered");
    expect(recoveryBandWord("yellow")).toBe("Adequate");
    expect(recoveryBandWord("red")).toBe("Low");
    expect(recoveryBandWord("none")).toBe("No reading");
  });
});

describe("recoveryBandColor — the one deliberate exception to the no-danger-red contract", () => {
  test("red is --danger and must not be 'fixed' to warning", () => {
    expect(recoveryBandColor("red")).toBe("var(--danger)");
  });

  test("green is --success and yellow is --warning", () => {
    expect(recoveryBandColor("green")).toBe("var(--success)");
    expect(recoveryBandColor("yellow")).toBe("var(--warning)");
  });

  test("no band takes muted ink, so an absence is never a colour", () => {
    expect(recoveryBandColor("none")).toBe("var(--muted)");
  });

  test("every band is a token, never a raw hex", () => {
    for (const band of ["green", "yellow", "red", "none"] as const) {
      expect(recoveryBandColor(band)).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  test("no band borrows the accent — this family paints no HRV status", () => {
    for (const band of ["green", "yellow", "red", "none"] as const) {
      expect(recoveryBandColor(band)).not.toBe("var(--accent)");
    }
  });
});

describe("round — a server figure rounded for display, never re-derived", () => {
  test("the Whoop RMSSD float that wraps the shipped row becomes an integer", () => {
    expect(round(96.10188)).toBe("96");
    expect(round(112.44031)).toBe("112");
  });

  test("a non-integral recovery score rounds too — it is a float on the wire", () => {
    expect(round(52.4)).toBe("52");
    expect(round(52.6)).toBe("53");
  });

  test("absent is an em dash, not a zero", () => {
    expect(round(null)).toBe("—");
  });
});

describe("MIN_BASELINE_DAYS", () => {
  test("is the server's MinBaselineDays", () => {
    expect(MIN_BASELINE_DAYS).toBe(14);
  });
});

describe("ordinal", () => {
  test("suffixes the ordinary cases", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(30)).toBe("30th");
  });

  // The teens are the whole reason this is a function and not a lookup on the
  // last digit: 11/12/13 take "th" even though 1/2/3 do not.
  test("gives the teens 'th'", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  test("resumes the pattern above the teens", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(111)).toBe("111th");
  });
});

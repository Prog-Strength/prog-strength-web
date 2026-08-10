import { describe, expect, test } from "vitest";
import type { RecoveryBaselineTrendView } from "@/lib/dashboard";
import {
  driftColor,
  driftGlyph,
  driftTag,
  hrvStatusColor,
  signed,
  signedUnit,
  statusWord,
  trendLabel,
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

describe("trendLabel", () => {
  test("glyph + word pairs per direction", () => {
    expect(trendLabel("rising")).toEqual({ glyph: "▲", word: "rising this week" });
    expect(trendLabel("falling")).toEqual({ glyph: "▼", word: "falling this week" });
    expect(trendLabel("steady")).toEqual({ glyph: "▬", word: "steady this week" });
    expect(trendLabel("unknown")).toEqual({ glyph: "·", word: "calibrating" });
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

describe("signedUnit", () => {
  test("appends the unit", () => {
    expect(signedUnit(-8.9, "ms", 1)).toBe("−8.9 ms");
    expect(signedUnit(2, "bpm")).toBe("+2 bpm");
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

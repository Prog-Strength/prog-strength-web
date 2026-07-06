/// <reference types="vitest/globals" />
import {
  initialsOf,
  runeLength,
  clampRunes,
  heightToDisplay,
  displayToCm,
  draftFromProfile,
  dirtyKeys,
  patchFromDraft,
  USERNAME_RE,
  BIO_MAX_RUNES,
  type Draft,
} from "./draft";
import type { ResolvedProfile } from "@/lib/api";

function profile(over: Partial<ResolvedProfile> = {}): ResolvedProfile {
  return {
    id: "u1",
    email: "lifter@example.com",
    display_name: "Sam",
    weight_unit: "lb",
    distance_unit: "mi",
    height_cm: 180,
    birthdate: null,
    sex: null,
    avatar_url: null,
    timezone: "America/Denver",
    calendar_default_detail: "time_block",
    username: "sam",
    bio: null,
    ...over,
  };
}

describe("initialsOf", () => {
  it("takes the first two letters of a single-word name", () => {
    expect(initialsOf("Sam")).toBe("SA");
  });
  it("takes first+last initials for a multi-word name", () => {
    expect(initialsOf("Sam Stone")).toBe("SS");
  });
  it("returns ? for an empty name", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("runeLength / clampRunes", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(runeLength("😀😀")).toBe(2);
  });
  it("clamps by runes without splitting a surrogate pair", () => {
    const out = clampRunes("😀".repeat(200), BIO_MAX_RUNES);
    expect(runeLength(out)).toBe(160);
  });
  it("leaves a short string untouched", () => {
    expect(clampRunes("hi", BIO_MAX_RUNES)).toBe("hi");
  });
});

describe("height conversion", () => {
  it("shows cm in inches when unit is in (180cm → 70.9)", () => {
    expect(heightToDisplay(180, "in")).toBe("70.9");
  });
  it("shows cm as-is when unit is cm", () => {
    expect(heightToDisplay(180, "cm")).toBe("180");
  });
  it("shows an empty string for a null height", () => {
    expect(heightToDisplay(null, "in")).toBe("");
  });
  it("converts an inches display back to cm rounded to 0.1 (72 → 182.9)", () => {
    expect(displayToCm("72", "in")).toBe(182.9);
  });
  it("passes a cm display through", () => {
    expect(displayToCm("180", "cm")).toBe(180);
  });
  it("maps an empty display to null", () => {
    expect(displayToCm("", "in")).toBe(null);
  });
  it("throws RangeError on a non-positive or non-finite height", () => {
    expect(() => displayToCm("0", "cm")).toThrow(RangeError);
    expect(() => displayToCm("abc", "cm")).toThrow(RangeError);
  });
});

describe("draftFromProfile / dirtyKeys / patchFromDraft", () => {
  it("projects a profile into a draft", () => {
    const d = draftFromProfile(profile());
    expect(d).toEqual({
      display_name: "Sam",
      username: "sam",
      bio: "",
      height: "70.9", // mi → inches
      birthdate: "",
      sex: "",
      distance_unit: "mi",
      weight_unit: "lb",
      calendar_default_detail: "time_block",
    });
  });
  it("reports no dirty keys for an unedited draft", () => {
    const base = draftFromProfile(profile());
    expect(dirtyKeys(base, base)).toEqual([]);
  });
  it("reports only the changed keys", () => {
    const base = draftFromProfile(profile());
    const next: Draft = { ...base, display_name: "Sammy", bio: "hi" };
    expect(dirtyKeys(base, next).sort()).toEqual(["bio", "display_name"]);
  });
  it("builds a patch of only the dirty keys, mapping height→height_cm and username lowercased", () => {
    const base = draftFromProfile(profile());
    const next: Draft = { ...base, display_name: "Sammy", username: "NewSam", height: "72" };
    expect(patchFromDraft(base, next)).toEqual({
      display_name: "Sammy",
      username: "newsam",
      height_cm: 182.9,
    });
  });
  it("maps a cleared height to height_cm null", () => {
    const base = draftFromProfile(profile());
    const next: Draft = { ...base, height: "" };
    expect(patchFromDraft(base, next)).toEqual({ height_cm: null });
  });
  it("maps a cleared bio to an empty string", () => {
    const base = draftFromProfile(profile({ bio: "old" }));
    const next: Draft = { ...base, bio: "" };
    expect(patchFromDraft(base, next)).toEqual({ bio: "" });
  });
});

describe("USERNAME_RE", () => {
  it("accepts a valid handle", () => {
    expect(USERNAME_RE.test("sam_99")).toBe(true);
  });
  it("rejects a leading digit / uppercase / too-short handle", () => {
    expect(USERNAME_RE.test("1bad")).toBe(false);
    expect(USERNAME_RE.test("Bad")).toBe(false);
    expect(USERNAME_RE.test("ab")).toBe(false);
  });
});

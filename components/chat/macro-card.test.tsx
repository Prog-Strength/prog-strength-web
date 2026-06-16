/// <reference types="vitest/globals" />
import { parseMacroTable } from "./macro-card";

describe("parseMacroTable", () => {
  it("parses a standard nutrition table", () => {
    const parsed = parseMacroTable(
      ["Item", "Calories", "Protein", "Carbs", "Fat"],
      [
        ["Chicken breast", "165", "31g", "0g", "3.6g"],
        ["Rice", "205", "4g", "45g", "0.4g"],
        ["Total", "370", "35g", "45g", "4g"],
      ],
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.items).toHaveLength(2);
    expect(parsed!.total).toEqual(
      expect.objectContaining({ label: "Total", protein: 35, carbs: 45, fat: 4 }),
    );
  });
  it("returns null for a non-macro table", () => {
    expect(parseMacroTable(["Exercise", "Sets", "Reps"], [["Squat", "3", "5"]])).toBeNull();
  });
  it("synthesizes a total when no Total row is present", () => {
    const parsed = parseMacroTable(
      ["Food", "Protein", "Carbs", "Fat"],
      [
        ["Eggs", "12", "1", "10"],
        ["Toast", "6", "24", "2"],
      ],
    );
    expect(parsed!.total).toEqual(expect.objectContaining({ protein: 18, carbs: 25, fat: 12 }));
  });
});

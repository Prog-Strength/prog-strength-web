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

  it("does not let the carb 'c' alias steal the Calories column", () => {
    const parsed = parseMacroTable(
      ["Item", "Calories", "Protein", "Carbs", "Fat"],
      [["Oats", "150", "5", "27", "3"]],
    );
    expect(parsed!.items[0]).toEqual(
      expect.objectContaining({ calories: 150, protein: 5, carbs: 27, fat: 3 }),
    );
  });

  it("returns null when only one macro column is present", () => {
    expect(parseMacroTable(["Item", "Protein"], [["Whey", "24"]])).toBeNull();
  });

  it("handles ragged rows (fewer cells than headers) without throwing", () => {
    const parsed = parseMacroTable(
      ["Food", "Protein", "Carbs", "Fat"],
      [["Banana", "1", "27"]], // missing the fat cell
    );
    expect(parsed!.items[0]).toEqual(expect.objectContaining({ protein: 1, carbs: 27, fat: null }));
  });

  it("detects a Total row appearing mid-table", () => {
    const parsed = parseMacroTable(
      ["Item", "Protein", "Carbs", "Fat"],
      [
        ["Eggs", "12", "1", "10"],
        ["Total", "12", "1", "10"],
        ["(notes)", "0", "0", "0"],
      ],
    );
    expect(parsed!.total.label).toBe("Total");
    expect(parsed!.items.map((i) => i.label)).toEqual(["Eggs", "(notes)"]);
  });

  it("yields null macro sums when every value cell is blank", () => {
    const parsed = parseMacroTable(
      ["Food", "Protein", "Carbs", "Fat"],
      [["Mystery", "—", "—", "—"]],
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.total).toEqual(
      expect.objectContaining({ protein: null, carbs: null, fat: null }),
    );
  });
});

/// <reference types="vitest/globals" />

import { render, screen, fireEvent, within } from "@testing-library/react";
import { MACRO_COLORS } from "@/lib/macro-colors";
import type { MacroGoals } from "@/lib/api";
import { HeroBand } from "./hero-band";

// --- fixtures (the representative day, Tue Jun 16) -------------------------

const GOALS: MacroGoals = {
  calories: 3400,
  protein_g: 185,
  carbs_g: 400,
  fat_g: 80,
  created_at: "2026-01-04T00:00:00Z",
  updated_at: "2026-01-04T00:00:00Z",
};

const TOTALS = { calories: 2560, protein_g: 140, fat_g: 105.5, carbs_g: 264 };

// Find the macro column whose uppercase label matches, then return that
// section so we can scope numeral / caption assertions to one macro.
function macroBlock(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const block = labelEl.parentElement;
  if (!block) throw new Error(`macro block for ${label} not found`);
  return block as HTMLElement;
}

describe("HeroBand", () => {
  it("renders the calories ring numerals and the remaining badge", () => {
    render(<HeroBand totals={TOTALS} goals={GOALS} onEditGoals={vi.fn()} />);

    expect(screen.getByText("2560")).toBeInTheDocument();
    expect(screen.getByText("of 3400 kcal")).toBeInTheDocument();
    expect(screen.getByText("840 left")).toBeInTheDocument();
  });

  it("renders each macro numeral, goal sublabel, and percentage", () => {
    render(<HeroBand totals={TOTALS} goals={GOALS} onEditGoals={vi.fn()} />);

    const protein = macroBlock("Protein");
    expect(within(protein).getByText("140")).toBeInTheDocument();
    expect(within(protein).getByText("/185g")).toBeInTheDocument();
    expect(within(protein).getByText("76%")).toBeInTheDocument();

    const carbs = macroBlock("Carbs");
    expect(within(carbs).getByText("264")).toBeInTheDocument();
    expect(within(carbs).getByText("/400g")).toBeInTheDocument();
    expect(within(carbs).getByText("66%")).toBeInTheDocument();

    const fat = macroBlock("Fat");
    expect(within(fat).getByText("105.5")).toBeInTheDocument();
    expect(within(fat).getByText("/80g")).toBeInTheDocument();
    // Percentage caption includes the OVER marker for the over-goal macro.
    expect(within(fat).getByText("132%", { exact: false })).toBeInTheDocument();
  });

  it("flips the over-goal (Fat) numeral and caption to the warning color and appends OVER", () => {
    render(<HeroBand totals={TOTALS} goals={GOALS} onEditGoals={vi.fn()} />);

    const fat = macroBlock("Fat");
    const fatNumeral = within(fat).getByText("105.5");
    expect(fatNumeral).toHaveStyle({ color: "var(--warning)" });

    // The percentage caption carries OVER and the warning color.
    const fatCaption = within(fat).getByText(/132%/);
    expect(fatCaption.textContent).toMatch(/OVER/);
    expect(fatCaption).toHaveStyle({ color: "var(--warning)" });
  });

  it("keeps under-goal macros tinted (not warning) and free of any OVER text", () => {
    render(<HeroBand totals={TOTALS} goals={GOALS} onEditGoals={vi.fn()} />);

    const protein = macroBlock("Protein");
    const proteinNumeral = within(protein).getByText("140");
    expect(proteinNumeral).toHaveStyle({ color: MACRO_COLORS.protein });
    expect(proteinNumeral).not.toHaveStyle({ color: "var(--warning)" });

    // No OVER marker on the under-goal macros.
    expect(within(protein).queryByText(/OVER/)).not.toBeInTheDocument();
    const carbs = macroBlock("Carbs");
    expect(within(carbs).queryByText(/OVER/)).not.toBeInTheDocument();
  });

  it("goals-never-set: shows consumed figures, the Set-your-goals prompt, and no goal-relative affordances", () => {
    const onEditGoals = vi.fn();
    const neverSet: MacroGoals = { ...GOALS, created_at: null, updated_at: null };
    render(<HeroBand totals={TOTALS} goals={neverSet} onEditGoals={onEditGoals} />);

    // Consumed numerals still render.
    expect(screen.getByText("2560")).toBeInTheDocument();
    expect(screen.getByText("140")).toBeInTheDocument();
    expect(screen.getByText("264")).toBeInTheDocument();
    expect(screen.getByText("105.5")).toBeInTheDocument();

    // The prompt button is present and wired to onEditGoals.
    const button = screen.getByRole("button", { name: "Set your goals" });
    fireEvent.click(button);
    expect(onEditGoals).toHaveBeenCalledTimes(1);

    // No percentage / over-state / goal sublabel affordances.
    expect(screen.queryByText(/132%/)).not.toBeInTheDocument();
    expect(screen.queryByText("76%")).not.toBeInTheDocument();
    expect(screen.queryByText(/OVER/)).not.toBeInTheDocument();
    expect(screen.queryByText("of 3400 kcal")).not.toBeInTheDocument();
    expect(screen.queryByText("840 left")).not.toBeInTheDocument();
    expect(screen.queryByText("/185g")).not.toBeInTheDocument();
  });
});

/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { MacroBar } from "./macro-bar";

describe("MacroBar", () => {
  it("renders value / goal and a fill when a goal is set", () => {
    render(<MacroBar kind="protein" value={90} goal={180} />);
    expect(screen.getByText("Protein")).toBeInTheDocument();
    // value / goal text, with the goal carried in a faint sub-span.
    expect(screen.getByText(/90/)).toBeInTheDocument();
    expect(screen.getByText(/180/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Protein" });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("clamps the fill at 100% when over goal", () => {
    render(<MacroBar kind="carbs" value={500} goal={250} />);
    expect(screen.getByRole("progressbar", { name: "Carbs" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("degrades to a 'set a goal' affordance when goal is null", () => {
    render(<MacroBar kind="fat" value={40} goal={null} />);
    expect(screen.getByText("set a goal")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Fat" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });
});

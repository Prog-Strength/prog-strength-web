/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { TILE_IDS, type TileId } from "@/lib/dashboard-tiles";
import { AddTileTray } from "./add-tile-tray";

describe("AddTileTray", () => {
  it("lists only the not-enabled tiles for the draft", () => {
    render(<AddTileTray draft={["running"]} onAdd={() => {}} />);

    // The other catalog titles are offered — including the rest of the
    // running family, since the draft only enables the "running" id itself.
    for (const title of [
      "Runs This Week",
      "Run Effort",
      "Vertical Gain",
      "Walking",
      "Cycling",
      "Hiking",
      "Lifting",
      "Steps",
      "Nutrition",
      "Bodyweight",
      "Recovery",
      "HRV Balance",
      "Morning Vitals",
      "Recovery Trend",
      "Recovery Log",
      "Streak",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // ...but the enabled "Training Load" (running) tile is not offered.
    expect(screen.queryByRole("button", { name: "Add Training Load" })).toBeNull();
  });

  it("fires onAdd with the clicked tile's id", () => {
    const onAdd = vi.fn();
    render(<AddTileTray draft={["running"]} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Cycling" }));
    expect(onAdd).toHaveBeenCalledWith("cycling");
  });

  it("shows a quiet note when every tile is added", () => {
    const full = TILE_IDS.slice() as TileId[];
    render(<AddTileTray draft={full} onAdd={() => {}} />);

    expect(screen.getByText("All tiles added")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

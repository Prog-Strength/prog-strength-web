/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { TILE_IDS, type TileId } from "@/lib/dashboard-tiles";
import { AddTileTray } from "./add-tile-tray";

describe("AddTileTray", () => {
  it("lists only the not-enabled tiles for the draft", () => {
    render(<AddTileTray draft={["running"]} onAdd={() => {}} />);

    // The nine other catalog titles are offered...
    for (const title of [
      "Walking",
      "Cycling",
      "Hiking",
      "Lifting",
      "Steps",
      "Nutrition",
      "Bodyweight",
      "Recovery",
      "Streak",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // ...but the enabled "Running" tile is not offered (no Add Running button).
    expect(screen.queryByRole("button", { name: "Add Running" })).toBeNull();
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

/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import type { DashboardSection } from "@/lib/api";
import { TILE_IDS, type TileId } from "@/lib/dashboard-tiles";
import { AddTileTray } from "./add-tile-tray";

function sec(id: string, tiles: TileId[], title = ""): DashboardSection {
  return { id, title, collapsed: false, tile_ids: tiles };
}

describe("AddTileTray", () => {
  it("lists only the not-enabled tiles for the draft", () => {
    render(
      <AddTileTray
        sections={[sec("s1", ["running"])]}
        targetSectionId="s1"
        onTargetChange={() => {}}
        onAdd={() => {}}
      />,
    );

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
      "Recovery Log",
      "Streak",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // ...but the enabled "Training Load" (running) tile is not offered.
    expect(screen.queryByRole("button", { name: "Add Training Load" })).toBeNull();
  });

  // Global uniqueness: a tile enabled in ANY section is off the menu, not just
  // one enabled in the tray's current target.
  it("excludes tiles enabled in a different section", () => {
    render(
      <AddTileTray
        sections={[sec("s1", ["running"]), sec("s2", ["cycling"], "Bike")]}
        targetSectionId="s1"
        onTargetChange={() => {}}
        onAdd={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add Cycling" })).toBeNull();
  });

  it("fires onAdd with the clicked tile's id and the target section", () => {
    const onAdd = vi.fn();
    render(
      <AddTileTray
        sections={[sec("s1", ["running"]), sec("s2", [], "Recovery")]}
        targetSectionId="s2"
        onTargetChange={() => {}}
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Cycling" }));
    expect(onAdd).toHaveBeenCalledWith("cycling", "s2");
  });

  it("hides the target picker when there is only one section", () => {
    render(
      <AddTileTray
        sections={[sec("s1", ["running"])]}
        targetSectionId="s1"
        onTargetChange={() => {}}
        onAdd={() => {}}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("offers a picker of every section, naming untitled ones positionally", () => {
    const onTargetChange = vi.fn();
    render(
      <AddTileTray
        sections={[sec("s1", ["running"]), sec("s2", [], "Recovery")]}
        targetSectionId="s1"
        onTargetChange={onTargetChange}
        onAdd={() => {}}
      />,
    );

    const picker = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "Untitled section 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Recovery" })).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "s2" } });
    expect(onTargetChange).toHaveBeenCalledWith("s2");
  });

  it("shows a quiet note when every tile is added", () => {
    const full = TILE_IDS.slice() as TileId[];
    render(
      <AddTileTray
        sections={[sec("s1", full)]}
        targetSectionId="s1"
        onTargetChange={() => {}}
        onAdd={() => {}}
      />,
    );

    expect(screen.getByText("All tiles added")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

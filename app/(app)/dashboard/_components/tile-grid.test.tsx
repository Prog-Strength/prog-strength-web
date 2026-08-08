/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import type { DashboardData } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { TileGrid } from "./tile-grid";

/** All sections empty except a present streak. */
function fixture(): DashboardData {
  return {
    sections: [],
    running: { present: false },
    walking: { present: false },
    cycling: { present: false },
    hiking: { present: false },
    lifting: { present: false },
    steps: { present: false },
    nutrition: { present: false },
    bodyweight: { present: false },
    bloodPressure: { present: false },
    quote: { present: false },
    recovery: { present: false },
    streak: {
      weeks: 3,
      activeDaysThisWeek: 2,
      week: [true, false, true, false, false, false, false],
      isNew: false,
    },
  };
}

const noop = () => {};

describe("TileGrid", () => {
  it("view mode renders the section's tiles in order", () => {
    const tileIds: TileId[] = ["lifting", "running", "streak"];
    render(
      <TileGrid sectionId="s1" tileIds={tileIds} data={fixture()} mode="view" onRemove={noop} />,
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Lifting", "Training Load", "Streak"]);
  });

  it("edit mode renders a labelled Remove button per tile and fires onRemove", () => {
    const onRemove = vi.fn();
    render(
      // Edit mode registers sortables and a droppable, so it needs a DndContext.
      <DndContext>
        <TileGrid
          sectionId="s1"
          tileIds={["running", "steps"]}
          data={fixture()}
          mode="edit"
          onRemove={onRemove}
        />
      </DndContext>,
    );

    expect(screen.getByRole("button", { name: "Remove Training Load" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Steps" })).toBeInTheDocument();
    // Each tile also exposes a labelled drag handle.
    expect(screen.getByRole("button", { name: "Reorder Training Load" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Steps" }));
    expect(onRemove).toHaveBeenCalledWith("steps");
  });

  // An empty section must stay droppable in edit mode — with no tile to drop
  // onto, the placeholder IS the drop target.
  it("edit mode renders a drop placeholder for an empty section", () => {
    render(
      <DndContext>
        <TileGrid sectionId="s1" tileIds={[]} data={fixture()} mode="edit" onRemove={noop} />
      </DndContext>,
    );

    expect(screen.getByText("Drag a tile here")).toBeInTheDocument();
  });

  it("view mode renders nothing for an empty section", () => {
    const { container } = render(
      <TileGrid sectionId="s1" tileIds={[]} data={fixture()} mode="view" onRemove={noop} />,
    );

    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(screen.queryByText("Drag a tile here")).toBeNull();
  });
});

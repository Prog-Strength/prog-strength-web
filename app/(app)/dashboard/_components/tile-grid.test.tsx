/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import type { DashboardData } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { TileGrid } from "./tile-grid";

/** All sections empty except a present streak; layout supplied per-test. */
function fixture(layout: TileId[]): DashboardData {
  return {
    layout,
    running: { present: false },
    walking: { present: false },
    cycling: { present: false },
    hiking: { present: false },
    lifting: { present: false },
    steps: { present: false },
    nutrition: { present: false },
    bodyweight: { present: false },
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
  it("view mode renders the tiles in layout order", () => {
    const layout: TileId[] = ["lifting", "running", "streak"];
    render(
      <TileGrid
        layout={layout}
        data={fixture(layout)}
        mode="view"
        onReorder={noop}
        onRemove={noop}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Lifting", "Running", "Streak"]);
  });

  it("edit mode renders a labelled Remove button per tile and fires onRemove", () => {
    const layout: TileId[] = ["running", "steps"];
    const onRemove = vi.fn();
    render(
      <TileGrid
        layout={layout}
        data={fixture(layout)}
        mode="edit"
        onReorder={noop}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByRole("button", { name: "Remove Running" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Steps" })).toBeInTheDocument();
    // Each tile also exposes a labelled drag handle.
    expect(screen.getByRole("button", { name: "Reorder Running" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Steps" }));
    expect(onRemove).toHaveBeenCalledWith("steps");
  });
});

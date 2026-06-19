/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { BodyweightEntry } from "@/lib/api";
import { BodyweightReadingsTimeline } from "./bodyweight-readings-timeline";

let nextId = 0;
function entry(weight: number, measured_at: string, unit: "lb" | "kg" = "lb"): BodyweightEntry {
  return { id: `e${nextId++}`, weight, unit, measured_at, created_at: measured_at };
}

function renderTimeline(
  entries: BodyweightEntry[],
  over: Partial<Parameters<typeof BodyweightReadingsTimeline>[0]> = {},
) {
  const props = {
    entries,
    displayUnit: "lb" as const,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onTapReading: vi.fn(),
    ...over,
  };
  render(<BodyweightReadingsTimeline {...props} />);
  return props;
}

describe("BodyweightReadingsTimeline", () => {
  it("renders an empty state when there are no entries", () => {
    renderTimeline([]);
    expect(screen.getByText(/no readings in this range/i)).toBeInTheDocument();
  });

  it("renders one node per local calendar day, newest first", () => {
    renderTimeline([
      entry(180, "2026-06-12T08:00:00"),
      entry(181, "2026-06-14T08:00:00"),
      entry(179, "2026-06-13T08:00:00"),
    ]);
    const nodes = screen.getAllByRole("listitem");
    expect(nodes).toHaveLength(3);
    expect(within(nodes[0]).getByText(/jun 14/i)).toBeInTheDocument();
    expect(within(nodes[2]).getByText(/jun 12/i)).toBeInTheDocument();
  });

  it("shows a multi-reading day's spread", () => {
    renderTimeline([entry(180, "2026-06-15T07:30:00"), entry(183, "2026-06-15T22:15:00")]);
    expect(screen.getByText(/3 lb/)).toBeInTheDocument();
    expect(screen.getByText(/7:30/i)).toBeInTheDocument();
    expect(screen.getByText(/10:15/i)).toBeInTheDocument();
  });

  it("labels a down move with the down delta and an up move with the up delta", () => {
    renderTimeline([
      entry(180, "2026-06-12T08:00:00"),
      entry(178, "2026-06-13T08:00:00"),
      entry(179, "2026-06-14T08:00:00"),
    ]);
    expect(screen.getByText(/↑\s*1 lb/)).toBeInTheDocument();
    expect(screen.getByText(/↓\s*2 lb/)).toBeInTheDocument();
  });

  it("fires onEdit and onDelete from the desktop affordances", () => {
    const props = renderTimeline([entry(180, "2026-06-15T07:30:00")]);
    fireEvent.click(screen.getByRole("button", { name: /edit reading/i }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /delete reading/i }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("fires onTapReading from the mobile bead button", () => {
    const props = renderTimeline([entry(180, "2026-06-15T07:30:00")]);
    fireEvent.click(screen.getByRole("button", { name: /180 lb on/i }));
    expect(props.onTapReading).toHaveBeenCalledTimes(1);
  });

  it("paginates by whole days without splitting a day, controls below", () => {
    const day1 = Array.from({ length: 12 }, (_, i) =>
      entry(180, `2026-06-14T0${i % 10}:0${i % 6}:00`),
    );
    const day2 = Array.from({ length: 12 }, (_, i) =>
      entry(179, `2026-06-13T0${i % 10}:0${i % 6}:00`),
    );
    renderTimeline([...day1, ...day2]);
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/jun 14/i)).toBeInTheDocument();
  });

  it("renders mixed-unit days in the display unit", () => {
    renderTimeline([entry(81.65, "2026-06-15T07:00:00", "kg")], { displayUnit: "lb" });
    expect(screen.getByText(/180 lb/)).toBeInTheDocument();
  });
});

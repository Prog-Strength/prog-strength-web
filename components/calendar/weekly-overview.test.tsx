import { render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import { WeeklyOverviewColumn, type WeeklyStat } from "./weekly-overview";

function makeWeek(weekStart: Date, overrides: Partial<WeeklyStat> = {}): WeeklyStat {
  return {
    weekStart,
    activities: 1,
    liftMinutes: 0,
    runMeters: 0,
    runMinutes: 0,
    ...overrides,
  };
}

function weekKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function renderColumn(weeks: WeeklyStat[], todayKey: string) {
  return render(
    <DistanceUnitProvider>
      <WeeklyOverviewColumn weeks={weeks} todayKey={todayKey} />
    </DistanceUnitProvider>,
  );
}

describe("WeeklyOverviewColumn", () => {
  it("renders one tile per week", () => {
    const weeks = Array.from({ length: 6 }, (_, i) => makeWeek(new Date(2026, 5, 1 + i * 7)));
    renderColumn(weeks, "2099-0-1");
    expect(screen.getAllByTestId("weekly-tile")).toHaveLength(6);
  });

  it("omits zero-value lift/run rows but keeps the sessions count", () => {
    const weeks = [
      makeWeek(new Date(2026, 5, 1), {
        activities: 2,
        liftMinutes: 0,
        runMeters: 0,
        runMinutes: 0,
      }),
    ];
    renderColumn(weeks, "2099-0-1");
    const tile = screen.getByTestId("weekly-tile");
    expect(tile).toHaveTextContent("2 activities");
    expect(tile).not.toHaveTextContent("Lift");
    expect(tile).not.toHaveTextContent("Run");
  });

  it("accents the tile for the current week", () => {
    const currentStart = new Date(2026, 5, 8);
    const weeks = [
      makeWeek(new Date(2026, 5, 1), { activities: 1 }),
      makeWeek(currentStart, { activities: 3 }),
      makeWeek(new Date(2026, 5, 15), { activities: 1 }),
    ];
    // todayKey lands on the 3rd day of the second week.
    const todayKey = weekKey(new Date(2026, 5, 10));
    renderColumn(weeks, todayKey);
    const tiles = screen.getAllByTestId("weekly-tile");
    expect(tiles[0]).not.toHaveAttribute("data-current");
    expect(tiles[1]).toHaveAttribute("data-current", "true");
    expect(tiles[1].className).toContain("border-[var(--accent)]");
    expect(tiles[2]).not.toHaveAttribute("data-current");
  });
});

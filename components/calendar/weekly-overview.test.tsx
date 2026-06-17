import { render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import { WeekColumn, type WeeklyStat, type DayMark } from "./weekly-overview";

function marks(pattern: Array<[boolean, boolean]>): DayMark[] {
  // pattern entries are [inMonth, trained]
  return pattern.map(([inMonth, trained]) => ({ inMonth, trained }));
}

function makeWeek(overrides: Partial<WeeklyStat> = {}): WeeklyStat {
  return {
    weekStart: new Date(2026, 5, 1),
    activities: 0,
    liftMinutes: 0,
    runMeters: 0,
    steps: 0,
    days: marks([
      [true, false],
      [true, false],
      [true, false],
      [true, false],
      [true, false],
      [true, false],
      [true, false],
    ]),
    ...overrides,
  };
}

function renderColumn(week: WeeklyStat, isCurrent = false) {
  return render(
    <DistanceUnitProvider>
      <WeekColumn week={week} isCurrent={isCurrent} />
    </DistanceUnitProvider>,
  );
}

describe("WeekColumn", () => {
  it("renders a trained-days indicator over in-month days", () => {
    const week = makeWeek({
      activities: 4,
      days: marks([
        [true, true],
        [true, false],
        [true, true],
        [true, true],
        [true, false],
        [true, true],
        [true, false],
      ]),
    });
    renderColumn(week);
    expect(screen.getByTestId("week-column")).toHaveTextContent("4/7");
  });

  it("counts only in-month days toward the trained-days total", () => {
    const week = makeWeek({
      activities: 1,
      days: marks([
        [false, false],
        [false, false],
        [true, true],
        [true, false],
        [true, false],
        [true, false],
        [true, false],
      ]),
    });
    renderColumn(week);
    expect(screen.getByTestId("week-column")).toHaveTextContent("1/5");
  });

  it("renders metric labels for sessions, lift time, run distance, and steps when present", () => {
    const week = makeWeek({ activities: 3, liftMinutes: 90, runMeters: 5000, steps: 8200 });
    renderColumn(week);
    const column = screen.getByTestId("week-column");
    expect(column).toHaveTextContent("3 sessions"); // session count
    expect(column).toHaveTextContent("1h 30m"); // lift time
    expect(column).toHaveTextContent("🏃"); // run distance label (unit via context)
    expect(column).toHaveTextContent("8,200"); // steps, thousands-separated
  });

  it("omits zero metric labels", () => {
    renderColumn(makeWeek({ activities: 1, liftMinutes: 0, runMeters: 0, steps: 0 }));
    const column = screen.getByTestId("week-column");
    expect(column).not.toHaveTextContent("1h");
    expect(column).not.toHaveTextContent("🏃");
    expect(column).not.toHaveTextContent("👟");
  });

  it("emphasizes the current week", () => {
    renderColumn(makeWeek(), true);
    expect(screen.getByTestId("week-column")).toHaveAttribute("data-current", "true");
  });
});

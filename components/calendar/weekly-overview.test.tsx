import { render, screen, within } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import { WeekStreakStrip, type WeeklyStat, type DayMark } from "./weekly-overview";

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

function renderStrip(week: WeeklyStat, isCurrent = false) {
  return render(
    <DistanceUnitProvider>
      <WeekStreakStrip week={week} isCurrent={isCurrent} />
    </DistanceUnitProvider>,
  );
}

describe("WeekStreakStrip", () => {
  it("renders seven day dots", () => {
    renderStrip(makeWeek());
    const strip = screen.getByTestId("week-streak-strip");
    expect(within(strip).getAllByTestId("streak-dot")).toHaveLength(7);
  });

  it("frames a trained week as N of M in-month days", () => {
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
    renderStrip(week);
    expect(screen.getByTestId("week-streak-strip")).toHaveTextContent("You trained 4 of 7 days");
  });

  it("counts only in-month days toward the N of M total", () => {
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
    renderStrip(week);
    expect(screen.getByTestId("week-streak-strip")).toHaveTextContent("You trained 1 of 5 days");
  });

  it("marks trained dots distinctly from untrained ones", () => {
    const week = makeWeek({
      days: marks([
        [true, true],
        [true, false],
        [true, false],
        [true, false],
        [true, false],
        [true, false],
        [true, false],
      ]),
    });
    renderStrip(week);
    const dots = screen.getAllByTestId("streak-dot");
    expect(dots[0]).toHaveAttribute("data-trained", "true");
    expect(dots[1]).not.toHaveAttribute("data-trained", "true");
  });

  it("shows a gentle rest-week line when no in-month day was trained", () => {
    renderStrip(makeWeek({ activities: 0 }));
    expect(screen.getByTestId("week-streak-strip")).toHaveTextContent(
      "Rest week — recovery counts too",
    );
  });

  it("renders metric labels for lift time, run distance, and steps when present", () => {
    const week = makeWeek({ activities: 3, liftMinutes: 90, runMeters: 5000, steps: 8200 });
    renderStrip(week);
    const strip = screen.getByTestId("week-streak-strip");
    expect(strip).toHaveTextContent("1h 30m"); // lift time
    expect(strip).toHaveTextContent("🏃"); // run distance label (unit via context)
    expect(strip).toHaveTextContent("8,200"); // steps, thousands-separated
  });

  it("omits zero metric labels", () => {
    renderStrip(makeWeek({ activities: 1, liftMinutes: 0, runMeters: 0, steps: 0 }));
    const strip = screen.getByTestId("week-streak-strip");
    expect(strip).not.toHaveTextContent("1h");
  });

  it("emphasizes the current week", () => {
    renderStrip(makeWeek(), true);
    const strip = screen.getByTestId("week-streak-strip");
    expect(strip).toHaveAttribute("data-current", "true");
  });
});

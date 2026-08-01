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
  it("renders word labels for run distance, lift time, and steps alongside the session count", () => {
    const week = makeWeek({ activities: 3, liftMinutes: 90, runMeters: 5000, steps: 8200 });
    renderColumn(week);
    const column = screen.getByTestId("week-column");
    expect(column).toHaveTextContent("3 sessions"); // session count
    expect(column).toHaveTextContent("Run"); // run distance (unit via context)
    expect(column).toHaveTextContent("Lift1h 30m"); // lift time
    expect(column).toHaveTextContent("Steps8,200"); // steps, thousands-separated
  });

  it("renders no pictographs as metric labels", () => {
    const week = makeWeek({ activities: 3, liftMinutes: 90, runMeters: 5000, steps: 8200 });
    renderColumn(week);
    // The emoji labels this column used to lean on read as tacky and left the
    // numbers ambiguous once removed; the labels are words now.
    expect(screen.getByTestId("week-column").textContent).toMatch(/^[\x20-\x7E,]*$/);
  });

  it("does not render a trained-days ratio", () => {
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
    // The calendar beside the rail already shows which days were trained.
    expect(screen.getByTestId("week-column")).not.toHaveTextContent("4/7");
  });

  it("uses a singular session label for a one-session week", () => {
    renderColumn(makeWeek({ activities: 1 }));
    expect(screen.getByTestId("week-column")).toHaveTextContent("1 session");
  });

  it("omits zero metrics", () => {
    renderColumn(makeWeek({ activities: 1, liftMinutes: 0, runMeters: 0, steps: 0 }));
    const column = screen.getByTestId("week-column");
    expect(column).not.toHaveTextContent("Run");
    expect(column).not.toHaveTextContent("Lift");
    expect(column).not.toHaveTextContent("Steps");
  });

  it("shows steps even when the week logged no sessions", () => {
    const column = renderColumn(makeWeek({ activities: 0, steps: 6400 })).getByTestId(
      "week-column",
    );
    expect(column).toHaveTextContent("Steps6,400");
    expect(column).not.toHaveTextContent("session");
  });

  it("collapses a week with nothing at all to an em dash", () => {
    renderColumn(makeWeek());
    const column = screen.getByTestId("week-column");
    expect(column).toHaveTextContent("—");
    expect(column).toHaveAttribute("aria-label", expect.stringContaining("no activity"));
  });

  it("speaks the week's metrics as one sentence", () => {
    renderColumn(makeWeek({ activities: 3, liftMinutes: 90, runMeters: 5000, steps: 8200 }));
    expect(screen.getByTestId("week-column").getAttribute("aria-label")).toContain(
      "3 sessions, Run",
    );
  });

  it("emphasizes the current week", () => {
    renderColumn(makeWeek(), true);
    expect(screen.getByTestId("week-column")).toHaveAttribute("data-current", "true");
  });
});

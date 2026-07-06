/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { StepsEntry } from "@/lib/api";
import { StepsLogAccordion } from "./steps-log-accordion";

function entry(date: string, steps: number): StepsEntry {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

const ENTRIES: StepsEntry[] = [
  entry("2026-07-05", 17000),
  entry("2026-07-04", 2000),
  entry("2026-07-03", 8500),
  entry("2026-07-02", 11200),
  entry("2026-07-01", 10400),
  entry("2026-06-30", 6100),
  entry("2026-06-29", 9800),
  entry("2026-06-28", 12500),
  entry("2026-06-27", 13000),
  entry("2026-06-26", 4200),
  entry("2026-06-25", 3800),
  entry("2026-06-24", 14000),
  entry("2026-06-23", 10100),
  entry("2026-06-22", 11000),
  entry("2026-06-21", 4800),
  entry("2026-06-20", 3200),
  entry("2026-06-19", 6100),
  entry("2026-06-18", 5400),
  entry("2026-06-17", 4000),
  entry("2026-06-16", 11000),
];

const GOAL = 10000;

function renderAccordion(props: Partial<React.ComponentProps<typeof StepsLogAccordion>> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onWeekPageChange = vi.fn();
  render(
    <StepsLogAccordion
      entries={ENTRIES}
      goal={GOAL}
      onEdit={onEdit}
      onDelete={onDelete}
      weekPage={0}
      onWeekPageChange={onWeekPageChange}
      pageCount={1}
      showPager={false}
      canGoOlder={false}
      loadingMore={false}
      resetKey={0}
      {...props}
    />,
  );
  return { onEdit, onDelete, onWeekPageChange };
}

describe("StepsLogAccordion", () => {
  it("renders week avg and success-green when week attainment clears goal", () => {
    const cleared = [entry("2026-07-05", 12000), entry("2026-07-04", 12000)];
    renderAccordion({ entries: cleared });
    const avg = screen.getByTestId("week-avg-2026-06-29");
    expect(avg).toHaveTextContent("12,000");
    expect(avg).toHaveStyle({ color: "var(--success)" });
  });

  it("inserts a July month divider when history spans months", () => {
    renderAccordion();
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("expands only the newest week by default", () => {
    renderAccordion();
    expect(screen.getByTestId("week-header-2026-06-29")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("week-header-2026-06-22")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Sun, Jul 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Sun, Jun 22/)).not.toBeInTheDocument();
  });

  it("hides the pager when showPager is false", () => {
    renderAccordion({ showPager: false });
    expect(screen.queryByRole("button", { name: /older/i })).not.toBeInTheDocument();
  });

  it("shows the week pager when showPager is true", () => {
    renderAccordion({ showPager: true, pageCount: 2, canGoOlder: true });
    expect(screen.getByText(/weeks · page 1 of 2/i)).toBeInTheDocument();
  });

  it("fires edit and delete callbacks from day rows", () => {
    const { onEdit, onDelete } = renderAccordion();
    fireEvent.click(screen.getAllByRole("button", { name: /edit steps/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-07-05" }));

    fireEvent.click(screen.getAllByRole("button", { name: /delete steps/i })[0]);
    expect(onDelete).toHaveBeenCalledWith("2026-07-05");
  });

  it("omits goal-% on day rows when no goal is set", () => {
    renderAccordion({ goal: null });
    const currentWeek = screen.getByTestId("week-header-2026-06-29");
    expect(within(currentWeek.closest("section")!).queryByText(/%/)).not.toBeInTheDocument();
  });
});

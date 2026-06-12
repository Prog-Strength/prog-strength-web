/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { MovementPatternFilter } from "./MovementPatternFilter";

const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

beforeEach(() => {
  replaceMock.mockClear();
  pushMock.mockClear();
});

describe("MovementPatternFilter", () => {
  it("replaces the URL with the clicked pattern, preserving days", () => {
    render(<MovementPatternFilter pattern="all" days={90} />);
    fireEvent.click(screen.getByRole("button", { name: "Push", pressed: false }));
    expect(replaceMock).toHaveBeenCalledWith("/progress?pattern=push&days=90");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("replaces the URL with the clicked days, preserving pattern", () => {
    render(<MovementPatternFilter pattern="push" days={90} />);
    fireEvent.click(screen.getByRole("button", { name: "Last 60d" }));
    expect(replaceMock).toHaveBeenCalledWith("/progress?pattern=push&days=60");
  });

  it("marks the active pattern with aria-pressed", () => {
    render(<MovementPatternFilter pattern="legs" days={90} />);
    expect(screen.getByRole("button", { name: "Legs" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Push" })).toHaveAttribute("aria-pressed", "false");
  });

  it("wraps the five pills in a labeled group", () => {
    render(<MovementPatternFilter pattern="all" days={90} />);
    const group = screen.getByRole("group", { name: "Movement pattern" });
    expect(group).toBeInTheDocument();
  });

  it("moves focus across the five chips with arrow keys (wrapping)", () => {
    render(<MovementPatternFilter pattern="push" days={90} />);
    const push = screen.getByRole("button", { name: "Push" });
    const pull = screen.getByRole("button", { name: "Pull" });
    const all = screen.getByRole("button", { name: "All" });

    push.focus();
    expect(push).toHaveFocus();

    fireEvent.keyDown(push, { key: "ArrowRight" });
    expect(pull).toHaveFocus();

    // Arrow-left from the first chip wraps to the last (All).
    fireEvent.keyDown(push, { key: "ArrowLeft" });
    expect(all).toHaveFocus();

    // Arrow-right from the last wraps back to the first (Push).
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(push).toHaveFocus();
  });
});

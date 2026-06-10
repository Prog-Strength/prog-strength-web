/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { ViewSwitcher } from "./ViewSwitcher";

const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

beforeEach(() => {
  replaceMock.mockClear();
  pushMock.mockClear();
});

describe("ViewSwitcher", () => {
  it("replaces the URL (not push) when the Running segment is clicked", () => {
    render(<ViewSwitcher view="lifts" />);
    fireEvent.click(screen.getByRole("tab", { name: "Running" }));
    expect(replaceMock).toHaveBeenCalledWith("/personal-records?view=running");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("marks the active segment with aria-selected", () => {
    render(<ViewSwitcher view="running" />);
    expect(screen.getByRole("tab", { name: "Running" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Lifts" })).toHaveAttribute("aria-selected", "false");
  });

  it("moves focus across segments with arrow keys", () => {
    render(<ViewSwitcher view="lifts" />);
    const lifts = screen.getByRole("tab", { name: "Lifts" });
    const running = screen.getByRole("tab", { name: "Running" });

    lifts.focus();
    expect(lifts).toHaveFocus();

    fireEvent.keyDown(lifts, { key: "ArrowRight" });
    expect(running).toHaveFocus();

    // Arrow-left wraps back to Lifts.
    fireEvent.keyDown(running, { key: "ArrowLeft" });
    expect(lifts).toHaveFocus();

    // Arrow-left from the first segment wraps to the last.
    fireEvent.keyDown(lifts, { key: "ArrowLeft" });
    expect(running).toHaveFocus();
  });

  it("activates the focused segment on Enter", () => {
    render(<ViewSwitcher view="lifts" />);
    const running = screen.getByRole("tab", { name: "Running" });
    fireEvent.keyDown(running, { key: "Enter" });
    expect(replaceMock).toHaveBeenCalledWith("/personal-records?view=running");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
